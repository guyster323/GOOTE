import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";
import { isValidGoogleGroupUrl } from "../src/lib/google-groups";
import { resolvePlayParticipationLink } from "../src/lib/play-links";

test.describe("Google Groups URL validation", () => {
  test("accepts current Google Groups link variants", async () => {
    expect(isValidGoogleGroupUrl("https://groups.google.com/g/buslink-testers")).toBeTruthy();
    expect(isValidGoogleGroupUrl("https://groups.google.com/forum/#!forum/buslink-testers")).toBeTruthy();
    expect(isValidGoogleGroupUrl("https://groups.google.com/a/example.com/g/buslink-testers")).toBeTruthy();
  });

  test("rejects non Google Groups urls", async () => {
    expect(isValidGoogleGroupUrl("http://groups.google.com/g/buslink-testers")).toBeFalsy();
    expect(isValidGoogleGroupUrl("https://play.google.com/store/apps/details?id=com.buslink")).toBeFalsy();
    expect(isValidGoogleGroupUrl("not-a-url")).toBeFalsy();
  });
});

test.describe("Play participation link resolution", () => {
  test("uses the tester opt-in link for Android when the saved Android URL is only a store listing", async () => {
    expect(resolvePlayParticipationLink({
      type: "android",
      androidParticipationLink: "https://play.google.com/store/apps/details?id=co.lottolab",
      webParticipationLink: "https://play.google.com/apps/testing/co.lottolab",
    })).toBe("https://play.google.com/apps/testing/co.lottolab");
  });

  test("keeps Android-specific tester opt-in links when present", async () => {
    expect(resolvePlayParticipationLink({
      type: "android",
      androidParticipationLink: "https://play.google.com/apps/testing/co.lottolab",
      webParticipationLink: "https://play.google.com/apps/testing/co.lottolab",
    })).toBe("https://play.google.com/apps/testing/co.lottolab");
  });
});

test.describe("App registration Google Groups persistence", () => {
  test("does not overwrite the developer-selected group with the shared fallback", async () => {
    const source = fs.readFileSync(path.join(process.cwd(), "functions", "src", "index.ts"), "utf8");
    const getAppInputBody = source.match(/const getAppInput = \(data: any\): AppInput => ([\s\S]*?);\r?\nconst buildAppPayload/)?.[1] ?? "";
    const buildAppPayloadBody = source.match(/const buildAppPayload = \([\s\S]*?\) => \(([\s\S]*?)\);\r?\nconst buildPlayConsoleTestingLink/)?.[1] ?? "";

    expect(getAppInputBody).not.toContain("buildSharedGroupPayload");
    expect(buildAppPayloadBody).not.toContain("buildSharedGroupPayload");
    expect(getAppInputBody).toContain("data?.googleGroupEmail");
    expect(getAppInputBody).toContain("data?.googleGroupLink");
  });
});
