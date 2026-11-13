import { expect, test } from "@playwright/test";
import fs from "node:fs";
import ts from "typescript";
import contract from "../functions/shared-contract.json";

const source = fs.readFileSync("functions/src/index.ts", "utf8");
const parsed = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);

test("shared backend preserves every deployed web and Android function", () => {
  const names = parsed.statements.filter(ts.isVariableStatement)
    .filter(n => n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))
    .flatMap(n => n.declarationList.declarations.map(d => d.name.getText(parsed)));
  expect(names.sort()).toEqual(contract.exports);
});

test("custom mail templates keep literal text and official tracking buttons", () => {
  const sourceFile = fs.readFileSync("functions/src/utils/html-mail.ts", "utf8");
  const javascript = ts.transpileModule(sourceFile, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("exports", "module", javascript)(loaded.exports, loaded);
  const render = loaded.exports.renderMailTemplate as (input: Record<string, unknown>) => string;
  const android = "https://us-central1-goote-f48d8.cloudfunctions.net/api/track-daily?pid=app_user&type=android&t=abc123";
  const web = "https://us-central1-goote-f48d8.cloudfunctions.net/api/track-daily?pid=app_user&type=web&t=abc123";
  const result = render({
    template: "{testerNickname}: {appName} {trackLinkAndroid} {trackLinkWeb}",
    testerNickname: "테스터",
    appName: "앱",
    trackLinkAndroid: android,
    trackLinkWeb: web,
  });
  const escapedAndroid = android.replace(/&/g, "&amp;");
  const escapedWeb = web.replace(/&/g, "&amp;");
  expect(result).toContain("테스터: 앱");
  expect(result).toContain(escapedAndroid);
  expect(result).toContain(escapedWeb);
  expect(result).toContain(`href="${escapedAndroid}"`);
  expect(result).not.toContain("${rendered}");
});

test("registration preserves developer groups and optional custom mail templates", () => {
  const declarations = new Map(parsed.statements.filter(ts.isVariableStatement)
    .map(n => [n.declarationList.declarations[0].name.getText(parsed), n]));
  const selected = new Set<string>();
  function include(name: string) {
    if (selected.has(name) || !declarations.has(name)) return;
    selected.add(name);
    function visit(node: ts.Node) {
      if (ts.isIdentifier(node)) include(node.text);
      ts.forEachChild(node, visit);
    }
    visit(declarations.get(name)!);
  }
  include("getAppInput");
  include("buildAppPayload");
  const code = ts.transpile(parsed.statements.filter(n => ts.isVariableStatement(n) &&
    selected.has(n.declarationList.declarations[0].name.getText(parsed)))
    .map(n => n.getText(parsed)).join("\n"), { target: ts.ScriptTarget.ES2020 });
  const { getAppInput, buildAppPayload } = new Function("functions", "admin",
    `${code}; return { getAppInput, buildAppPayload };`)(
    { https: { HttpsError: Error } },
    { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } });
  const input = { name: "Test", packageName: "com.example.test", category: "utility",
    testDuration: 14, minTesters: 12, description: "Test app",
    androidParticipationLink: "https://play.google.com/apps/testing/com.example.test",
    webParticipationLink: "https://play.google.com/apps/testing/com.example.test",
    googleGroupEmail: "custom@googlegroups.com", googleGroupLink: "https://groups.google.com/g/custom" };
  const result = buildAppPayload(getAppInput({ ...input, mailTemplate: "Hello {testerNickname}" }), "owner", "Developer");
  expect(result.mailTemplate).toBe("Hello {testerNickname}");
  expect(result.googleGroupEmail).toBe(input.googleGroupEmail);
  expect(result.googleGroupLink).toBe(input.googleGroupLink);
  expect(getAppInput(input)).not.toHaveProperty("mailTemplate");
  expect(() => getAppInput({ ...input, mailTemplate: "x".repeat(4001) })).toThrow();
});
