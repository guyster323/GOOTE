#!/usr/bin/env node
const { spawn } = require("child_process");

const args = process.argv.slice(2);
const deployArgs = args.length > 0 ? args : ["deploy", "--only", "functions"];

const child = spawn("firebase", deployArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "60",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
