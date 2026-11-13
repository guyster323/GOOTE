export type OnboardingWrite<T> =
  | { kind: "update"; data: { nickname: string; updatedAt: T } }
  | { kind: "create"; data: Record<string, unknown> };

const INITIAL_STATS = {
  appsRegistered: 0,
  testsJoined: 0,
  testsCompleted: 0,
  totalLikes: 0,
  totalConsecutiveDays: 0,
};

export const buildOnboardingWrite = <T>(input: {
  exists: boolean;
  uid: string;
  nickname: string;
  email?: string | null;
  photoURL?: string | null;
  timestamp: T;
}): OnboardingWrite<T> => {
  const nickname = input.nickname.trim();
  if (input.exists) {
    return {
      kind: "update",
      data: {
        nickname,
        updatedAt: input.timestamp,
      },
    };
  }

  const email = input.email?.trim() || "";
  const data: Record<string, unknown> = {
    uid: input.uid,
    nickname,
    profileImage: input.photoURL?.trim() || "",
    dismissedGuides: [],
    stats: { ...INITIAL_STATS },
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
  if (email) data.email = email;
  return { kind: "create", data };
};
