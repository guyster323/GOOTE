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

test("custom mail templates render participant values and tracking links", () => {
  const statement = parsed.statements.filter(ts.isVariableStatement)
    .find(n => n.declarationList.declarations[0].name.getText(parsed) === "renderMailTemplate");
  expect(statement).toBeDefined();
  const javascript = ts.transpile(statement!.getText(parsed), { target: ts.ScriptTarget.ES2020 });
  const render = new Function(`${javascript}; return renderMailTemplate;`)();
  const result = render("{testerNickname}: {appName} {trackLinkAndroid} {trackLinkWeb}", {
    testerNickname: "테스터", appName: "앱", trackLinkAndroid: "https://example.com/android",
    trackLinkWeb: "https://example.com/web",
  });
  expect(result).toContain("테스터: 앱 https://example.com/android https://example.com/web");
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
