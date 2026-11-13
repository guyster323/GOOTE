export type AuthIdentity = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

export type BootstrapPlan = {
  action: "create" | "merge";
  document: Record<string, unknown>;
};

const EMPTY_STATS = {
  appsRegistered: 0,
  testsJoined: 0,
  testsCompleted: 0,
  totalLikes: 0,
  totalConsecutiveDays: 0,
};

const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const initialNickname = (auth: AuthIdentity): string => {
  const displayName = auth.displayName?.trim();
  if (displayName) return displayName.slice(0, 100);
  const email = auth.email?.trim() || "";
  const localPart = email.includes("@") ? email.split("@")[0].trim() : "";
  return (localPart || "User").slice(0, 100);
};

export const planUserBootstrap = (
  existing: Record<string, unknown> | null,
  auth: AuthIdentity,
  roleForEmail: (email?: string | null) => string,
  now: () => unknown
): BootstrapPlan => {
  const email = auth.email?.trim() || "";
  if (!existing) {
    const document: Record<string, unknown> = {
      uid: auth.uid,
      nickname: initialNickname(auth),
      profileImage: auth.photoURL?.trim() || "",
      role: roleForEmail(email),
      createdAt: now(),
      updatedAt: now(),
      stats: { ...EMPTY_STATS },
      settings: { emailNotifications: true },
    };
    if (email) document.email = email;
    return { action: "create", document };
  }

  const document: Record<string, unknown> = {};
  if (!hasNonEmptyString(existing.uid)) document.uid = auth.uid;
  if (email && !hasNonEmptyString(existing.email)) document.email = email;
  if (!hasNonEmptyString(existing.nickname)) document.nickname = initialNickname(auth);
  if (!hasNonEmptyString(existing.profileImage) && auth.photoURL?.trim()) {
    document.profileImage = auth.photoURL.trim();
  }
  if (!hasNonEmptyString(existing.role)) document.role = roleForEmail(email);
  if (existing.createdAt == null) document.createdAt = now();
  if (existing.stats == null) document.stats = { ...EMPTY_STATS };
  if (existing.settings == null) document.settings = { emailNotifications: true };
  if (Object.keys(document).length > 0) document.updatedAt = now();
  return { action: "merge", document };
};
