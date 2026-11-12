// Prepare with --prepare <inventory.json> <output-directory>.
// Run prepared builds with --run <output-directory>, then inspect with --status.
// Requires the existing, signed-in Firebase CLI installation. Never deploys functions.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const PROJECT = 'goote-f48d8';
const BASE = `https://cloudbuild.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/builds`;

async function connect() {
  const globalRoot = process.platform === 'win32'
    ? path.join(process.env.APPDATA, 'npm', 'node_modules')
    : execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  const auth = require(path.join(globalRoot, 'firebase-tools/lib/auth.js'));
  const account = auth.findAccountByEmail('window98se@gmail.com');
  if (!account) throw new Error('Sign in to Firebase CLI as window98se@gmail.com first.');
  const token = await auth.getAccessToken(account.tokens.refresh_token,
    ['https://www.googleapis.com/auth/cloud-platform']);
  return async (url, body) => {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result.error?.message}`);
    return result;
  };
}

const snapshot = (functions) => functions.map(f => ({
  name: f.name, state: f.state, updateTime: f.updateTime,
  build: f.buildConfig?.build, revision: f.serviceConfig?.revision,
})).sort((a, b) => a.name.localeCompare(b.name));

async function main() {
  const [mode, input, output] = process.argv.slice(2);
  const directory = path.resolve(mode === '--prepare' ? output : input);
  fs.mkdirSync(directory, { recursive: true });
  const statePath = path.join(directory, 'state.json');
  if (mode === '--prepare') {
    if (fs.existsSync(statePath)) throw new Error('Output already prepared; choose a new directory.');
    const inventory = JSON.parse(fs.readFileSync(input, 'utf8'));
    const ids = ['a64426cb-5c2d-499b-8ab6-ea97ef5ea729',
      '2f924d65-6a43-41dc-918a-03ea1deb4230',
      'b81369f4-7d13-4fe7-a949-226b8313d20f',
      '343cc23e-a52d-475e-8606-c11a6dd8dcdf'];
    const state = { project: PROJECT, preparedAt: new Date().toISOString(), tests: [] };
    for (const id of ids) {
      const b = inventory.builds.find(build => build.id === id);
      if (!b) throw new Error(`Missing original build ${id}`);
      const target = b.substitutions._GOOGLE_FUNCTION_TARGET;
      const image = b.steps.find(s => s.id === 'pre-buildpack').args
        .find(a => a.startsWith('--app_image_stable=')).slice('--app_image_stable='.length)
        .replace(/:latest$/, '');
      const testImage = `us-central1-docker.pkg.dev/${PROJECT}/gcf-artifacts/compat-20261112-${target.toLowerCase()}`;
      const steps = b.steps.map(step => Object.fromEntries(
        ['name', 'args', 'env', 'id', 'entrypoint', 'dir', 'waitFor', 'volumes', 'timeout', 'secretEnv']
          .filter(key => step[key] !== undefined).map(key => [key, step[key]])));
      let request = { steps, timeout: '1200s', serviceAccount: b.serviceAccount,
        options: { ...b.options, workerRelease: 'regular' },
        tags: ['compatibility-check', 'regular-20261112'] };
      request = JSON.parse(JSON.stringify(request).split(image).join(testImage));
      request.steps.unshift({ id: 'verify-worker-docker', name: 'gcr.io/cloud-builders/docker', args: ['version'] });
      if (JSON.stringify(request).includes(image)) throw new Error('Production image reference remains.');
      const file = `${target}.request.json`;
      fs.writeFileSync(path.join(directory, file), JSON.stringify(request, null, 2));
      state.tests.push({ originalId: id, target, runtime: b.substitutions._GOOGLE_RUNTIME,
        source: b.substitutions._GOOGLE_LABEL_SOURCE, testImage, file });
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify({ prepared: state.tests.length, directory, submitted: false }));
    return;
  }
  if (!['--run', '--status'].includes(mode)) throw new Error('Use --prepare, --run or --status.');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const request = await connect();
  const functionsUrl = `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/-/functions`;
  if (mode === '--run') {
    if (state.startedAt) throw new Error('Already started; use --status.');
    const current = await request(functionsUrl);
    if (current.nextPageToken) throw new Error('Function pagination requires review.');
    state.baseline = snapshot(current.functions || []);
    const expected = new Set(state.tests.map(t => t.originalId));
    if (state.baseline.some(f => !expected.has(f.build?.split('/').pop())))
      throw new Error('Production build selection changed. Prepare a fresh review.');
    // Check every source before submitting any build.
    for (const test of state.tests) {
      const match = test.source.match(/^gs:\/\/([^/]+)\/(.+)#(\d+)$/);
      if (!match) throw new Error(`Unversioned source: ${test.target}`);
      const meta = await request(`https://storage.googleapis.com/storage/v1/b/${match[1]}/o/${encodeURIComponent(match[2])}`);
      const reviewedPath = path.join(directory, 'preflight.json');
      const reviewed = fs.existsSync(reviewedPath)
        ? JSON.parse(fs.readFileSync(reviewedPath, 'utf8')).sources.find(s => s.target === test.target)
        : undefined;
      const expectedGeneration = match[3] === '0' ? reviewed?.generation : match[3];
      if (!expectedGeneration || meta.generation !== expectedGeneration)
        throw new Error(`Source changed or has no reviewed generation: ${test.target}`);
    }
    state.startedAt = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    for (const test of state.tests) {
      const build = JSON.parse(fs.readFileSync(path.join(directory, test.file), 'utf8'));
      const operation = await request(BASE, build);
      test.id = operation.metadata?.build?.id;
      test.operation = operation.name;
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      console.log(JSON.stringify({ target: test.target, id: test.id, operation: test.operation }));
    }
  } else {
    for (const test of state.tests) {
      if (!test.id) { console.log(JSON.stringify({ target: test.target, status: 'NOT_SUBMITTED' })); continue; }
      const build = await request(`${BASE}/${test.id}`);
      test.status = build.status;
      test.channel = build.options?.workerRelease;
      test.resolvedWorkerRelease = build.options?.resolvedWorkerRelease;
      test.finishTime = build.finishTime;
      test.logUrl = build.logUrl;
      fs.writeFileSync(path.join(directory, `${test.target}.result.json`), JSON.stringify(build, null, 2));
      console.log(JSON.stringify({ target: test.target, id: test.id, status: test.status,
        channel: test.channel, steps: build.steps.map(s => ({ id: s.id, status: s.status, exitCode: s.exitCode })) }));
    }
    const current = await request(functionsUrl);
    state.productionUnchanged = !current.nextPageToken &&
      JSON.stringify(snapshot(current.functions || [])) === JSON.stringify(state.baseline);
    state.passed = state.tests.every(t => t.status === 'SUCCESS' && t.channel === 'regular') && state.productionUnchanged;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify({ passed: state.passed, productionUnchanged: state.productionUnchanged }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
