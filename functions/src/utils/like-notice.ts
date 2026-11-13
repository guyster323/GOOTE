export type LikeNotice = {
  userId: string;
  title: string;
  content: string;
  link: string;
  data: { fromUserId: string; appId?: string };
};

const displayName = (nickname: unknown): string => {
  if (typeof nickname !== "string") return "누군가";
  const trimmed = nickname.trim().replace(/[\r\n]+/g, " ");
  return trimmed ? trimmed.slice(0, 100) : "누군가";
};

const appLabel = (appName: unknown): string => {
  if (typeof appName !== "string") return "앱";
  const trimmed = appName.trim().replace(/[\r\n]+/g, " ");
  return trimmed ? trimmed.slice(0, 100) : "앱";
};

export const buildLikeNotification = (input: {
  toType: "app" | "user";
  toId: string;
  fromUserId: string;
  developerId?: string;
  appName?: unknown;
  senderNickname?: unknown;
}): LikeNotice | null => {
  const name = displayName(input.senderNickname);
  if (input.toType === "app") {
    if (!input.developerId || input.developerId === input.fromUserId) return null;
    const label = appLabel(input.appName);
    return {
      userId: input.developerId,
      title: "새로운 앱 좋아요",
      content: `${name}님이 '${label}' 앱을 좋아합니다.`,
      link: `/my-apps/${encodeURIComponent(input.toId)}/manage`,
      data: { appId: input.toId, fromUserId: input.fromUserId },
    };
  }

  if (input.toId === input.fromUserId) return null;
  return {
    userId: input.toId,
    title: "새로운 프로필 좋아요",
    content: `${name}님이 회원님을 좋아합니다.`,
    link: "/ranking",
    data: { fromUserId: input.fromUserId },
  };
};
