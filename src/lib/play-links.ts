export type PlayParticipationLinkType = "android" | "web";

const isPlayStoreDetailsUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "play.google.com" && parsed.pathname === "/store/apps/details";
  } catch {
    return false;
  }
};

const isPlayTestingUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "play.google.com" && parsed.pathname.startsWith("/apps/testing/");
  } catch {
    return false;
  }
};

export function resolvePlayParticipationLink({
  type,
  androidParticipationLink,
  webParticipationLink,
}: {
  type: PlayParticipationLinkType;
  androidParticipationLink?: string | null;
  webParticipationLink?: string | null;
}) {
  const androidLink = androidParticipationLink?.trim() || "";
  const webLink = webParticipationLink?.trim() || "";

  if (type === "web") {
    return webLink;
  }

  if (androidLink && isPlayStoreDetailsUrl(androidLink) && isPlayTestingUrl(webLink)) {
    return webLink;
  }

  return androidLink;
}
