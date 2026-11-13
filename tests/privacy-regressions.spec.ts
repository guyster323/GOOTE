import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const load = (path: string) => {
  const javascript = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} as Record<string, any> };
  new Function("exports", "module", javascript)(loaded.exports, loaded);
  return loaded.exports;
};

const loadGraph = (entry: string) => {
  const cache = new Map<string, Record<string, any>>();
  const loadFrom = (filePath: string): Record<string, any> => {
    const resolved = path.resolve(filePath);
    const cached = cache.get(resolved);
    if (cached) return cached;
    const javascript = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const loaded = { exports: {} as Record<string, any> };
    const localRequire = (request: string) => {
      if (!request.startsWith(".")) throw new Error(`Unexpected import ${request}`);
      const target = path.resolve(path.dirname(resolved), request);
      return loadFrom(target.endsWith(".ts") ? target : `${target}.ts`);
    };
    new Function("exports", "module", "require", javascript)(loaded.exports, loaded, localRequire);
    cache.set(resolved, loaded.exports);
    return loaded.exports;
  };
  return loadFrom(entry);
};

const mail = load("functions/src/utils/html-mail.ts");
const privacy = load("functions/src/utils/member-privacy.ts");
const bootstrap = load("functions/src/utils/profile-bootstrap.ts");
const likes = load("functions/src/utils/like-notice.ts");
const onboarding = load("src/lib/onboarding-profile.ts");
const sensitive = load("src/lib/sensitive-request.ts");
const notices = loadGraph("functions/src/utils/developer-notice.ts");

const android = "https://us-central1-goote-f48d8.cloudfunctions.net/api/track-daily?pid=app_user&type=android&t=token123";
const web = "https://us-central1-goote-f48d8.cloudfunctions.net/api/track-daily?pid=app_user&type=web&t=token123";
const approval = "https://us-central1-goote-f48d8.cloudfunctions.net/api/track-daily?pid=app_user&type=approval&t=token123";

test("mail keeps literal replacements, unicode, newlines, and official buttons", () => {
  const malicious = "<a href=\"https://evil.example\"><img src=x onerror=\"alert(1)\"></a>&#60;script&#62;";
  const result = mail.renderMailTemplate({
    template: `${malicious}\n{testerNickname} {appName} {trackLinkAndroid}`,
    testerNickname: "테스터 $& $` $' $1 {appName}",
    appName: "앱 <b>",
    trackLinkAndroid: android,
    trackLinkWeb: web,
    isNudge: true,
  });
  expect(result).toContain("GOOTE REMINDER");
  expect(result).toContain("테스터 $&amp; $` $&#39; $1 {appName}");
  expect(result).toContain("앱 &lt;b&gt;");
  expect(result).toContain("<br>");
  expect(result).toContain(`href="${android.replace(/&/g, "&amp;")}"`);
  expect(result).toContain(`href="${web.replace(/&/g, "&amp;")}"`);
  expect(result).not.toContain("<a href=\"https://evil.example\"");
  expect(result).not.toContain("<img");
  expect(result).not.toContain("<script");
  expect(result).toContain("&amp;#60;script&amp;#62;");

  const empty = mail.renderMailTemplate({
    testerNickname: "테스터<img>",
    appName: "이름\"onclick",
    category: "utility",
    iconUrl: "https://cdn.example/icon.png\" onerror=\"alert(1)",
    trackLinkAndroid: android,
    trackLinkWeb: "javascript:alert(1)",
    isNudge: false,
  });
  expect(empty).toContain("테스터&lt;img&gt;");
  expect(empty).toContain("이름&quot;onclick");
  expect(empty).toContain(`href="${android.replace(/&/g, "&amp;")}"`);
  expect(empty).not.toContain("javascript:");
  expect(empty).not.toContain("<img");
});

test("participation, approval, and comment mail escape dynamic text", () => {
  const participation = mail.renderParticipationEmail({
    testerNickname: "<b>닉</b>",
    testerEmail: "a@example.com",
    appName: "앱<img>",
    manageUrl: "https://goote-f48d8.web.app/my-apps/app/manage",
  });
  expect(participation).toContain("&lt;b&gt;닉&lt;/b&gt;");
  expect(participation).toContain("앱&lt;img&gt;");
  expect(participation).toContain("https://goote-f48d8.web.app/my-apps/app/manage");
  expect(participation).not.toContain("<b>");

  const badLink = mail.renderParticipationEmail({ manageUrl: "https://evil.example/my-apps/app" });
  expect(badLink).not.toContain("evil.example");

  const approved = mail.renderApprovalEmail({
    testerNickname: "테스터",
    appName: "<script>",
    trackLink: approval,
  });
  expect(approved).toContain("&lt;script&gt;");
  expect(approved).toContain(`href="${approval.replace(/&/g, "&amp;")}"`);

  const comment = mail.renderCommentEmail({
    commenterName: "<i>",
    appName: "앱",
    content: "줄\n<script>",
    commentLink: "https://goote-f48d8.web.app/apps/app",
  });
  expect(comment).toContain("&lt;i&gt;");
  expect(comment).toContain("줄<br>&lt;script&gt;");
  expect(comment).not.toContain("<script>");
});

const user = (id: string, data: Record<string, unknown>) => ({ id, data: { uid: id, ...data } });

const storeFor = (seed: {
  users: Record<string, Record<string, unknown>>;
  apps?: Record<string, { developerId?: string }>;
  participations?: Array<{ id: string; data: Record<string, unknown> }>;
}) => ({
  async getUser(uid: string) {
    return seed.users[uid] ? user(uid, seed.users[uid]) : null;
  },
  async listUsers() {
    return Object.entries(seed.users).map(([id, data]) => user(id, data));
  },
  async getApp(appId: string) {
    return seed.apps?.[appId] || null;
  },
  async listParticipations(appId: string) {
    return (seed.participations || []).filter((item) => item.data.appId === appId);
  },
});

const primary = { uid: "owner", email: "owner@example.com", emailVerified: true };
const secondary = { uid: "admin2", email: "second@example.com", emailVerified: true };
const developer = { uid: "dev", email: "dev@example.com", emailVerified: true };
const memberSeed = {
  users: {
    owner: { role: "admin", email: "forged-firestore@example.com", nickname: "오너", stats: { appsRegistered: 1, testsJoined: 2, testsCompleted: 3 } },
    admin2: { role: "admin", email: "second@example.com", nickname: "보조", stats: { testsJoined: 4 } },
    member: { role: "user", email: "secretlocal@example.com", nickname: "멤버", profileImage: "javascript:alert(1)", stats: { testsJoined: 9, totalLikes: 8 }, settings: { emailNotifications: false }, dailyTrackToken: "secret" },
    dev: { role: "user", email: "dev@example.com", nickname: "개발자" },
  },
  apps: { app: { developerId: "dev" }, adminApp: { developerId: "admin2" } },
  participations: [
    { id: "app_member", data: { appId: "app", testerId: "member", testerEmail: "copied@example.com", testerNickname: "옛이름", status: "active", consecutiveDays: 2, targetDays: 14, lastCheckIn: "2026-11-13", dailyTrackToken: "token", createdAt: 10, updatedAt: 20 } },
    { id: "admin_member", data: { appId: "adminApp", testerId: "member", testerEmail: "secretlocal@example.com", status: "pending", dailyTrackToken: "other-token" } },
  ],
};

test("member directory masks every non-primary admin, including a forged profile email", async () => {
  const store = storeFor(memberSeed);
  const full = await privacy.loadMemberDirectory(primary, store, "owner@example.com");
  expect(full.members.find((member: any) => member.id === "member").email).toBe("secretlocal@example.com");
  expect(JSON.stringify(full)).not.toContain("dailyTrackToken");
  expect(JSON.stringify(full)).not.toContain("emailNotifications");

  const masked = await privacy.loadMemberDirectory(secondary, store, "owner@example.com");
  const serialized = JSON.stringify(masked);
  expect(serialized).not.toContain("secretlocal");
  expect(serialized).not.toContain("second@example.com");
  expect(masked.members.find((member: any) => member.id === "admin2").email).toBe("s***@example.com");
  expect(masked.members.find((member: any) => member.id === "member").email).toBe("s***@example.com");
  expect(masked.members.find((member: any) => member.id === "owner").email).toBe("f***@example.com");

  const unverified = await privacy.loadMemberDirectory(
    { ...primary, emailVerified: false },
    store,
    "owner@example.com"
  );
  expect(JSON.stringify(unverified)).not.toContain("secretlocal@example.com");

  const missingConfig = await privacy.loadMemberDirectory(primary, store, "");
  expect(JSON.stringify(missingConfig)).not.toContain("secretlocal@example.com");

  await expect(privacy.loadMemberDirectory(
    { uid: "member", email: "owner@example.com", emailVerified: true },
    store,
    "owner@example.com"
  )).rejects.toMatchObject({ code: "permission-denied" });
});

test("public profiles and app participants expose only their allowlists", async () => {
  const store = storeFor(memberSeed);
  const profiles = await privacy.loadPublicProfiles({ uid: "member", emailVerified: false }, store);
  const serialized = JSON.stringify(profiles);
  expect(serialized).not.toContain("email");
  expect(serialized).not.toContain("secretlocal");
  expect(serialized).not.toContain("dailyTrackToken");
  expect(serialized).not.toContain("javascript:");
  expect(profiles.profiles.find((profile: any) => profile.id === "member").stats.testsJoined).toBe(9);
  expect(profiles.profiles.find((profile: any) => profile.id === "member").stats.totalLikes).toBeUndefined();

  const developerView = await privacy.loadAppParticipants(developer, store, "owner@example.com", "app");
  expect(developerView.participants[0].email).toBe("secretlocal@example.com");
  expect(developerView.participants[0].nickname).toBe("멤버");
  expect(JSON.stringify(developerView)).not.toContain("token");
  expect(developerView.participants[0].dailyTrackToken).toBeUndefined();

  const adminOwner = await privacy.loadAppParticipants(secondary, store, "owner@example.com", "adminApp");
  expect(adminOwner.participants[0].email).toBe("s***@example.com");
  expect(JSON.stringify(adminOwner)).not.toContain("secretlocal");

  const primaryView = await privacy.loadAppParticipants(primary, store, "owner@example.com", "app");
  expect(primaryView.participants[0].email).toBe("secretlocal@example.com");

  await expect(privacy.loadAppParticipants(
    { uid: "member", email: "secretlocal@example.com", emailVerified: true },
    store,
    "owner@example.com",
    "app"
  )).rejects.toMatchObject({ code: "permission-denied" });
  await expect(privacy.loadPublicProfiles({ uid: null }, store)).rejects.toMatchObject({ code: "unauthenticated" });
});

test("email mask handles short, unicode, and invalid values", () => {
  expect(privacy.maskEmail("a@example.com")).toBe("*@example.com");
  expect(privacy.maskEmail("ab@example.com")).toBe("a***@example.com");
  expect(privacy.maskEmail("가나다@example.com")).toBe("가***@example.com");
  expect(privacy.maskEmail("")).toBeNull();
  expect(privacy.maskEmail("not-an-email")).toBeNull();
  expect(privacy.maskEmail("a@localhost")).toBeNull();
  expect(privacy.maskEmail(null)).toBeNull();
});

test("profile bootstrap and onboarding do not clobber an existing profile", () => {
  const existing = {
    uid: "active",
    email: "active@example.com",
    nickname: "카카오",
    profileImage: "https://cdn.example/a.png",
    role: "user",
    createdAt: "original",
    stats: { totalLikes: 5 },
    dismissedGuides: ["setup"],
    settings: { emailNotifications: false },
  };
  const plan = bootstrap.planUserBootstrap(existing, {
    uid: "active",
    email: "other@example.com",
    displayName: "Auth",
    photoURL: "",
  }, () => "admin", () => "now");
  expect(plan.document).toEqual({});

  const created = bootstrap.planUserBootstrap(null, { uid: "new", email: "", displayName: "신규" }, () => "user", () => "now");
  expect(created.action).toBe("create");
  expect(created.document.email).toBeUndefined();
  expect(created.document.nickname).toBe("신규");
  expect(created.document.dismissedGuides).toBeUndefined();

  const backfill = bootstrap.planUserBootstrap({ nickname: "있음", stats: { totalLikes: 1 } }, {
    uid: "legacy",
    email: "legacy@example.com",
  }, (email: string) => email === "legacy@example.com" ? "admin" : "user", () => "now");
  expect(backfill.document.nickname).toBeUndefined();
  expect(backfill.document.stats).toBeUndefined();
  expect(backfill.document.email).toBe("legacy@example.com");
  expect(backfill.document.role).toBe("admin");

  const update = onboarding.buildOnboardingWrite({
    exists: true,
    uid: "active",
    nickname: "변경",
    email: "other@example.com",
    photoURL: "",
    timestamp: "now",
  });
  expect(update).toEqual({ kind: "update", data: { nickname: "변경", updatedAt: "now" } });
  const fresh = onboarding.buildOnboardingWrite({
    exists: false,
    uid: "new",
    nickname: "신규",
    email: "",
    photoURL: null,
    timestamp: "now",
  });
  expect(fresh.kind).toBe("create");
  expect(fresh.data.email).toBeUndefined();
  expect(fresh.data.role).toBeUndefined();
  expect(fresh.data.stats.totalLikes).toBe(0);
});

test("like notifications use the stored sender for both targets", () => {
  const appNotice = likes.buildLikeNotification({
    toType: "app",
    toId: "app",
    fromUserId: "owner",
    developerId: "dev",
    appName: "앱",
    senderNickname: "실제닉",
  });
  expect(appNotice.content).toBe("실제닉님이 '앱' 앱을 좋아합니다.");
  expect(appNotice.content).not.toContain("위조");
  expect(appNotice.userId).toBe("dev");

  const userNotice = likes.buildLikeNotification({
    toType: "user",
    toId: "member",
    fromUserId: "owner",
    senderNickname: "실제닉",
  });
  expect(userNotice.content).toBe("실제닉님이 회원님을 좋아합니다.");
  expect(userNotice.link).toBe("/ranking");
  expect(likes.buildLikeNotification({
    toType: "app",
    toId: "app",
    fromUserId: "dev",
    developerId: "dev",
    senderNickname: "실제닉",
  })).toBeNull();
  expect(likes.buildLikeNotification({
    toType: "user",
    toId: "owner",
    fromUserId: "owner",
    senderNickname: "실제닉",
  })).toBeNull();
});

test("outgoing developer mail masks secondary admins and keeps ordinary developer contact", async () => {
  const calls: Array<{ to: string; html: string; replyTo?: string }> = [];
  const authLookups: string[] = [];
  const send = async (message: { to: string; html: string; replyTo?: string }) => {
    calls.push(message);
  };
  const base = {
    getRecipient: async (developerId: string) => ({
      primary: { role: "admin", email: "owner@example.com" },
      secondary: { role: "admin", email: "second@example.com" },
      developer: { role: "user", email: "dev@example.com" },
    })[developerId] || null,
    getAuthUser: async (developerId: string) => {
      authLookups.push(developerId);
      if (developerId === "primary") return { email: "owner@example.com", emailVerified: true };
      if (developerId === "secondary") return { email: "stored-owner@example.com", emailVerified: true };
      return { email: "dev@example.com", emailVerified: true };
    },
    sendGmail: send,
    configuredEmail: "owner@example.com",
  };
  await notices.deliverParticipationNotice(base, {
    developerId: "primary",
    testerNickname: "멤버",
    testerEmail: "secretlocal@example.com",
    appName: "앱",
    manageUrl: "https://goote-f48d8.web.app/my-apps/app/manage",
  });
  await notices.deliverParticipationNotice(base, {
    developerId: "secondary",
    testerNickname: "멤버",
    testerEmail: "secretlocal@example.com",
    appName: "앱",
    manageUrl: "https://goote-f48d8.web.app/my-apps/app/manage",
  });
  await notices.deliverParticipationNotice({ ...base, configuredEmail: "" }, {
    developerId: "primary",
    testerEmail: "secretlocal@example.com",
    appName: "앱",
    manageUrl: "https://goote-f48d8.web.app/my-apps/app/manage",
  });
  await notices.deliverParticipationNotice(base, {
    developerId: "developer",
    testerEmail: "secretlocal@example.com",
    appName: "앱",
    manageUrl: "https://goote-f48d8.web.app/my-apps/app/manage",
  });
  await notices.deliverCommentNotice(base, {
    developerId: "secondary",
    commenterName: "멤버",
    commenterEmail: "secretlocal@example.com",
    appName: "앱",
    content: "피드백",
    commentLink: "https://goote-f48d8.web.app/apps/app",
  });

  expect(calls[0].to).toBe("owner@example.com");
  expect(calls[0].html).toContain("secretlocal@example.com");
  expect(calls[0].replyTo).toBe("secretlocal@example.com");
  expect(calls[1].to).toBe("second@example.com");
  expect(calls[1].html).toContain("s***@example.com");
  expect(calls[1].html).not.toContain("secretlocal");
  expect(calls[1].replyTo).toBeUndefined();
  expect(calls[2].html).not.toContain("secretlocal");
  expect(calls[2].replyTo).toBeUndefined();
  expect(calls[3].to).toBe("dev@example.com");
  expect(calls[3].html).toContain("secretlocal@example.com");
  expect(calls[3].replyTo).toBe("secretlocal@example.com");
  expect(calls[4].replyTo).toBeUndefined();
  expect(calls[4].html).not.toContain("secretlocal");
  expect(authLookups).not.toContain("developer");
});

test("stale primary results cannot overwrite a later viewer and removal updates counts", () => {
  let generation = 0;
  let identity = sensitive.viewerIdentityKey({
    uid: "primary",
    email: "owner@example.com",
    emailVerified: true,
    role: "admin",
  });
  const primaryGeneration = sensitive.startSensitiveGeneration(generation);
  generation = primaryGeneration;
  const secondaryIdentity = sensitive.viewerIdentityKey({
    uid: "secondary",
    email: "second@example.com",
    emailVerified: true,
    role: "admin",
  });
  const secondaryGeneration = sensitive.startSensitiveGeneration(generation);
  generation = secondaryGeneration;
  identity = secondaryIdentity;
  expect(sensitive.publishIfCurrent(generation, identity, {
    generation: primaryGeneration,
    identityKey: sensitive.viewerIdentityKey({
      uid: "primary",
      email: "owner@example.com",
      emailVerified: true,
      role: "admin",
    }),
    rows: [{ id: "member", email: "secretlocal@example.com" }],
  })).toBeNull();
  const published = sensitive.publishIfCurrent(generation, identity, {
    generation: secondaryGeneration,
    identityKey: secondaryIdentity,
    rows: [{ id: "member", email: "s***@example.com" }, { id: "other", email: "o***@example.com" }],
  });
  expect(published).toEqual([
    { id: "member", email: "s***@example.com" },
    { id: "other", email: "o***@example.com" },
  ]);
  const remaining = sensitive.removeSensitiveRow(published, "member");
  expect(remaining).toEqual([{ id: "other", email: "o***@example.com" }]);
  expect(remaining).toHaveLength(1);
  expect(sensitive.canRemoveMember("secondary", { id: "secondary", role: "admin" })).toBe(false);
  expect(sensitive.canRemoveMember("secondary", { id: "member", role: "user" })).toBe(true);

  const primarySnapshot = {
    identityKey: sensitive.viewerIdentityKey({
      uid: "primary",
      email: "owner@example.com",
      emailVerified: true,
      role: "admin",
      scope: "members",
    }),
    rows: [{ id: "member", email: "secretlocal@example.com" }],
  };
  expect(sensitive.visibleBoundRows(primarySnapshot, secondaryIdentity)).toEqual([]);
  expect(sensitive.visibleBoundRows(primarySnapshot, primarySnapshot.identityKey)).toEqual(primarySnapshot.rows);
  expect(sensitive.removeBoundRow(primarySnapshot, "member", secondaryIdentity)).toEqual(primarySnapshot);
});
