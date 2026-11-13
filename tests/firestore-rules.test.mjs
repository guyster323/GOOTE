import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

let environment;
before(async () => {
  environment = await initializeTestEnvironment({ projectId: "demo-goote-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8") } });
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "users/owner"), { uid: "owner", role: "user", email: "owner@example.com", nickname: "Owner", profileImage: "", stats: {} });
    await setDoc(doc(db, "users/legacy"), { uid: "legacy", email: "legacy@example.com", nickname: "Legacy", profileImage: "", stats: {} });
    await setDoc(doc(db, "users/admin"), { uid: "admin", role: "admin" });
    await setDoc(doc(db, "users/stranger"), { uid: "stranger", role: "user" });
    await setDoc(doc(db, "users/active"), {
      uid: "active",
      role: "user",
      email: "active@example.com",
      nickname: "Active",
      profileImage: "https://cdn.example/a.png",
      stats: { totalLikes: 5, appsRegistered: 2, testsJoined: 3, testsCompleted: 1, totalConsecutiveDays: 4 },
      dismissedGuides: ["setup"],
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    await setDoc(doc(db, "apps/app"), { developerId: "owner" });
    await setDoc(doc(db, "apps/admin-app"), { developerId: "admin" });
    await setDoc(doc(db, "participations/participation"), { appId: "app", testerId: "tester", testerEmail: "tester@example.com" });
    await setDoc(doc(db, "participations/admin-participation"), { appId: "admin-app", testerId: "tester", testerEmail: "tester@example.com" });
    await setDoc(doc(db, "users/review-admin"), { uid: "review-admin", role: "admin" });
    await setDoc(doc(db, "users/review-dev"), { uid: "review-dev", role: "user" });
    await setDoc(doc(db, "users/review-victim"), { uid: "review-victim", role: "user", email: "victim-private@example.com" });
    await setDoc(doc(db, "apps/review-app"), { developerId: "review-dev" });
    await setDoc(doc(db, "participations/review-private"), {
      appId: "review-app",
      testerId: "review-victim",
      testerEmail: "victim-private@example.com",
      dailyTrackToken: "secret-token",
    });
    await setDoc(doc(db, "participations/review-leave"), { appId: "review-app", testerId: "review-victim" });
    await setDoc(doc(db, "participations/review-dev-delete"), { appId: "review-app", testerId: "review-victim" });
    await setDoc(doc(db, "participations/review-admin-delete"), { appId: "review-app", testerId: "review-victim" });
  });
});
after(async () => { await environment?.cleanup(); });

test("roleless legacy users can update nickname and dismissed guides", async () => {
  const db = environment.authenticatedContext("legacy").firestore();
  await assertSucceeds(updateDoc(doc(db, "users/legacy"), { nickname: "Updated", dismissedGuides: ["setup"] }));
});
test("users cannot change protected role, email or statistics", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  for (const patch of [{ role: "admin" }, { email: "other@example.com" }, { stats: { totalLikes: 999 } }]) {
    await assertFails(updateDoc(doc(db, "users/owner"), patch));
  }
});
test("tester and non-admin developer can read participation; admin and outsider cannot", async () => {
  await assertSucceeds(getDoc(doc(environment.authenticatedContext("owner").firestore(), "participations/participation")));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext("tester").firestore(), "participations/participation")));
  await assertFails(getDoc(doc(environment.authenticatedContext("admin").firestore(), "participations/participation")));
  await assertFails(getDoc(doc(environment.authenticatedContext("admin").firestore(), "participations/admin-participation")));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext("tester").firestore(), "participations/admin-participation")));
  await assertFails(getDoc(doc(environment.authenticatedContext("stranger").firestore(), "participations/participation")));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), "participations/participation")));
});
test("raw user reads are limited to the owner", async () => {
  await assertSucceeds(getDoc(doc(environment.authenticatedContext("owner").firestore(), "users/owner")));
  await assertFails(getDoc(doc(environment.authenticatedContext("owner").firestore(), "users/stranger")));
  await assertFails(getDoc(doc(environment.authenticatedContext("admin").firestore(), "users/owner")));
  await assertFails(getDocs(collection(environment.authenticatedContext("admin").firestore(), "users")));
  await assertFails(getDocs(collection(environment.authenticatedContext("owner").firestore(), "users")));
});
test("admins cannot client-write protected profile fields", async () => {
  const adminDb = environment.authenticatedContext("admin").firestore();
  await assertFails(updateDoc(doc(adminDb, "users/owner"), { role: "admin" }));
  await assertFails(updateDoc(doc(adminDb, "users/owner"), { email: "forged@example.com" }));
  await assertFails(updateDoc(doc(adminDb, "users/admin"), { email: "other@example.com" }));
});
test("existing onboarding payload cannot reset protected profile state", async () => {
  const db = environment.authenticatedContext("active").firestore();
  const ref = doc(db, "users/active");
  await assertFails(setDoc(ref, {
    uid: "active",
    email: "active@example.com",
    nickname: "Renamed",
    profileImage: "",
    dismissedGuides: [],
    stats: { appsRegistered: 0, testsJoined: 0, testsCompleted: 0, totalLikes: 0, totalConsecutiveDays: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true }));
  await assertSucceeds(updateDoc(ref, { nickname: "Renamed", updatedAt: new Date() }));
  await environment.withSecurityRulesDisabled(async (context) => {
    const saved = (await getDoc(doc(context.firestore(), "users/active"))).data();
    if (saved.stats.totalLikes !== 5 || saved.email !== "active@example.com" || saved.dismissedGuides[0] !== "setup") {
      throw new Error("existing profile state changed");
    }
    if (saved.profileImage !== "https://cdn.example/a.png" || saved.nickname !== "Renamed") {
      throw new Error("nickname update did not preserve the photo");
    }
    if (!saved.createdAt || saved.createdAt.toMillis() !== new Date("2020-01-01T00:00:00.000Z").getTime()) {
      throw new Error("createdAt changed");
    }
  });
});
test("new profiles reject an empty email and a self-appointed admin", async () => {
  const base = { nickname: "No", profileImage: "", stats: {} };
  await assertFails(setDoc(doc(environment.authenticatedContext("blankmail").firestore(), "users/blankmail"), { ...base, uid: "blankmail", email: "" }));
  await assertSucceeds(setDoc(doc(environment.authenticatedContext("nomail").firestore(), "users/nomail"), { ...base, uid: "nomail" }));
  await assertSucceeds(setDoc(doc(environment.authenticatedContext("hasmail").firestore(), "users/hasmail"), { ...base, uid: "hasmail", email: "has@example.com" }));
});
test("admin cannot rewrite participation identity to read a private tester email", async () => {
  const adminDb = environment.authenticatedContext("review-admin").firestore();
  const ref = doc(adminDb, "participations/review-private");
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, { testerId: "review-admin" }));
  await assertFails(updateDoc(ref, { testerEmail: "review-admin@example.com" }));
  await assertFails(updateDoc(ref, { dailyTrackToken: "rewritten" }));
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(doc(environment.authenticatedContext("review-dev").firestore(), "participations/review-private"), { status: "completed" }));
  await environment.withSecurityRulesDisabled(async (context) => {
    const saved = (await getDoc(doc(context.firestore(), "participations/review-private"))).data();
    if (saved.testerId !== "review-victim" || saved.testerEmail !== "victim-private@example.com" || saved.dailyTrackToken !== "secret-token") {
      throw new Error("participation identity changed");
    }
  });
  await assertSucceeds(getDoc(doc(environment.authenticatedContext("review-victim").firestore(), "participations/review-private")));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext("review-dev").firestore(), "participations/review-private")));
  await assertSucceeds(deleteDoc(doc(environment.authenticatedContext("review-victim").firestore(), "participations/review-leave")));
  await assertSucceeds(deleteDoc(doc(environment.authenticatedContext("review-dev").firestore(), "participations/review-dev-delete")));
  await assertSucceeds(deleteDoc(doc(environment.authenticatedContext("review-admin").firestore(), "participations/review-admin-delete")));
});
test("likes require the authenticated sender and a bounded target", async () => {
  const ownerDb = environment.authenticatedContext("owner").firestore();
  const legitimate = {
    fromUserId: "owner",
    fromUserNickname: "Owner",
    toType: "app",
    toId: "app",
    toName: "App",
    review: "좋습니다",
    createdAt: new Date(),
  };
  await assertFails(setDoc(doc(ownerDb, "likes/spoof"), { ...legitimate, fromUserId: "stranger" }));
  await assertFails(setDoc(doc(ownerDb, "likes/bad-type"), { ...legitimate, toType: "comment" }));
  await assertFails(setDoc(doc(ownerDb, "likes/empty-target"), { ...legitimate, toId: "" }));
  await assertSucceeds(setDoc(doc(ownerDb, "likes/app-like"), legitimate));
  await assertSucceeds(setDoc(doc(ownerDb, "likes/user-like"), { ...legitimate, toType: "user", toId: "stranger" }));
  await assertSucceeds(deleteDoc(doc(ownerDb, "likes/app-like")));
  await assertFails(deleteDoc(doc(environment.authenticatedContext("stranger").firestore(), "likes/user-like")));
});
test("onboarding permits ordinary profiles and rejects self-appointed admins", async () => {
  const user = { uid: "new", email: "new@example.com", nickname: "New", profileImage: "", stats: {} };
  const ref = doc(environment.authenticatedContext("new").firestore(), "users/new");
  await assertFails(setDoc(ref, { ...user, role: "admin" }));
  await assertSucceeds(setDoc(ref, user));
});
test("app mutations remain server-only", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  await assertFails(setDoc(doc(db, "apps/new"), { developerId: "owner" }));
  await assertFails(updateDoc(doc(db, "apps/app"), { name: "Direct write" }));
});
