import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

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
    await setDoc(doc(db, "apps/app"), { developerId: "owner" });
    await setDoc(doc(db, "participations/participation"), { appId: "app", testerId: "tester" });
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
test("admin, app owner and tester can read participation; outsider cannot", async () => {
  for (const uid of ["admin", "owner", "tester"]) {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext(uid).firestore(), "participations/participation")));
  }
  await assertFails(getDoc(doc(environment.authenticatedContext("stranger").firestore(), "participations/participation")));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), "participations/participation")));
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
