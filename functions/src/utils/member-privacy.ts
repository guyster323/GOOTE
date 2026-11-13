export type CallerAuth = {
  uid: string | null;
  email?: string | null;
  emailVerified?: boolean;
};

export type StoredDocument = {
  id: string;
  data: Record<string, unknown>;
};

export type PrivacyStore = {
  getUser(uid: string): Promise<StoredDocument | null>;
  listUsers(): Promise<StoredDocument[]>;
  getApp(appId: string): Promise<{ developerId?: unknown } | null>;
  listParticipations(appId: string): Promise<StoredDocument[]>;
};

export class PrivacyError extends Error {
  constructor(
    public code: "unauthenticated" | "permission-denied" | "invalid-argument" | "not-found",
    message: string
  ) {
    super(message);
  }
}

const normalizeEmail = (email?: string | null): string => email?.trim().toLowerCase() ?? "";

const requireCaller = (auth: CallerAuth): string => {
  if (!auth.uid) throw new PrivacyError("unauthenticated", "로그인이 필요합니다.");
  return auth.uid;
};

const requireId = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new PrivacyError("invalid-argument", "요청 값이 올바르지 않습니다.");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || trimmed.includes("/")) {
    throw new PrivacyError("invalid-argument", "요청 값이 올바르지 않습니다.");
  }
  return trimmed;
};

export const maskEmail = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@") || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || local.includes("@")) return null;
  const chars = Array.from(local);
  if (chars.length === 1) return `*@${domain}`;
  return `${chars[0]}***@${domain}`;
};

const visibleEmail = (value: unknown, full: boolean): string | null => {
  if (!maskEmail(value)) return null;
  return full && typeof value === "string" ? value.trim() : maskEmail(value);
};

export function contactForRecipient(input: {
  contactEmail: unknown;
  recipientRole: unknown;
  recipientAuth?: { email?: string | null; emailVerified?: boolean } | null;
  configuredEmail?: string | null;
}): { emailForBody: string | null; replyTo?: string } {
  const raw = typeof input.contactEmail === "string" ? input.contactEmail.trim() : "";
  const valid = maskEmail(input.contactEmail);
  const allowFull = input.recipientRole !== "admin" || isVerifiedPrimaryAdmin(
    {
      uid: "recipient",
      email: input.recipientAuth?.email,
      emailVerified: input.recipientAuth?.emailVerified === true,
    },
    input.recipientRole,
    input.configuredEmail,
  );
  if (!allowFull) return { emailForBody: valid };
  return {
    emailForBody: valid ? raw : null,
    replyTo: valid ? raw : undefined,
  };
}

export const isVerifiedPrimaryAdmin = (
  auth: CallerAuth,
  role: unknown,
  configuredEmail: string | null | undefined
): boolean => {
  const configured = normalizeEmail(configuredEmail);
  if (!configured || !auth.uid || auth.emailVerified !== true) return false;
  const email = normalizeEmail(auth.email);
  return Boolean(email) && email === configured && role === "admin";
};

const textField = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\r\n]+/g, " ").slice(0, maxLength);
};

const stat = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
};

const statsOf = (data: Record<string, unknown>): Record<string, unknown> =>
  data.stats && typeof data.stats === "object" ? data.stats as Record<string, unknown> : {};

const httpsImage = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
};

const millisOf = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return null;
  const timestamp = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
  if (typeof timestamp.toMillis === "function") {
    const millis = timestamp.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  const seconds = typeof timestamp.seconds === "number"
    ? timestamp.seconds
    : typeof timestamp._seconds === "number"
      ? timestamp._seconds
      : null;
  return seconds == null ? null : seconds * 1000;
};

const projectMember = (user: StoredDocument, fullEmail: boolean) => {
  const stats = statsOf(user.data);
  return {
    id: user.id,
    uid: textField(user.data.uid, 200) || user.id,
    nickname: textField(user.data.nickname, 100),
    profileImage: httpsImage(user.data.profileImage),
    role: user.data.role === "admin" ? "admin" : "user",
    email: visibleEmail(user.data.email, fullEmail),
    stats: {
      appsRegistered: stat(stats.appsRegistered),
      testsJoined: stat(stats.testsJoined),
      testsCompleted: stat(stats.testsCompleted),
    },
  };
};

export const loadMemberDirectory = async (
  auth: CallerAuth,
  store: PrivacyStore,
  configuredEmail: string | null | undefined
) => {
  const uid = requireCaller(auth);
  const caller = await store.getUser(uid);
  if (caller?.data.role !== "admin") {
    throw new PrivacyError("permission-denied", "관리자만 수행할 수 있습니다.");
  }
  const fullEmail = isVerifiedPrimaryAdmin(auth, caller.data.role, configuredEmail);
  const users = await store.listUsers();
  return { members: users.map((user) => projectMember(user, fullEmail)) };
};

export const loadPublicProfiles = async (auth: CallerAuth, store: PrivacyStore) => {
  requireCaller(auth);
  const users = await store.listUsers();
  return {
    profiles: users.map((user) => {
      const stats = statsOf(user.data);
      return {
        id: user.id,
        uid: textField(user.data.uid, 200) || user.id,
        nickname: textField(user.data.nickname, 100),
        profileImage: httpsImage(user.data.profileImage),
        stats: {
          testsJoined: stat(stats.testsJoined),
          testsCompleted: stat(stats.testsCompleted),
          totalConsecutiveDays: stat(stats.totalConsecutiveDays),
        },
      };
    }),
  };
};

const authoritativeText = (profileValue: unknown, participationValue: unknown): string =>
  textField(profileValue, 100) || textField(participationValue, 100);

export const loadAppParticipants = async (
  auth: CallerAuth,
  store: PrivacyStore,
  configuredEmail: string | null | undefined,
  appIdValue: unknown
) => {
  const uid = requireCaller(auth);
  const appId = requireId(appIdValue);
  const app = await store.getApp(appId);
  if (!app) throw new PrivacyError("not-found", "앱을 찾을 수 없습니다.");

  const caller = await store.getUser(uid);
  const isAdmin = caller?.data.role === "admin";
  const isDeveloper = app.developerId === uid;
  if (!isAdmin && !isDeveloper) {
    throw new PrivacyError("permission-denied", "권한이 없습니다.");
  }

  const fullEmail = isAdmin
    ? isVerifiedPrimaryAdmin(auth, caller?.data.role, configuredEmail)
    : true;
  const participations = await store.listParticipations(appId);
  const participants = await Promise.all(participations.map(async (participation) => {
    const testerId = textField(participation.data.testerId, 200);
    const profile = testerId ? await store.getUser(testerId) : null;
    const profileData = profile?.data || {};
    return {
      id: participation.id,
      testerId,
      status: textField(participation.data.status, 40),
      consecutiveDays: stat(participation.data.consecutiveDays),
      targetDays: stat(participation.data.targetDays),
      lastCheckIn: textField(participation.data.lastCheckIn, 40),
      createdAt: millisOf(participation.data.createdAt),
      updatedAt: millisOf(participation.data.updatedAt),
      nickname: authoritativeText(profileData.nickname, participation.data.testerNickname),
      email: visibleEmail(hasEmail(profileData.email) ? profileData.email : participation.data.testerEmail, fullEmail),
    };
  }));
  return { appId, participants };
};

const hasEmail = (value: unknown): boolean => maskEmail(value) != null;
