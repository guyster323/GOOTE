const TRACK_HOST = /^us-central1-[a-z0-9-]+\.cloudfunctions\.net$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER = /\{(testerNickname|appName|trackLinkAndroid|trackLinkWeb)\}/g;

export type TrackType = "android" | "web" | "approval";

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const oneLineText = (value: unknown, fallback: string): string => {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return text.replace(/[\r\n]+/g, " ").slice(0, 200);
};

export const safeReplyAddress = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed) || !EMAIL_PATTERN.test(trimmed)) return undefined;
  return trimmed;
};

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const parseHttpsUrl = (value: unknown): URL | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || /[\s"'<>\\]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
};

export const officialTrackUrl = (value: unknown, type: TrackType): string | null => {
  const url = parseHttpsUrl(value);
  if (!url || !TRACK_HOST.test(url.hostname) || url.pathname !== "/api/track-daily") return null;
  if (url.searchParams.get("type") !== type) return null;
  const pid = url.searchParams.get("pid") || "";
  const token = url.searchParams.get("t") || "";
  if (!pid || pid.length > 300 || !token || token.length > 200) return null;
  return url.toString();
};

export const safeIconUrl = (value: unknown): string | null => {
  const url = parseHttpsUrl(value);
  return url ? url.toString() : null;
};

const officialAppUrl = (value: unknown, pathPrefix: string): string | null => {
  const url = parseHttpsUrl(value);
  if (!url || url.hostname !== "goote-f48d8.web.app" || !url.pathname.startsWith(pathPrefix)) return null;
  return url.toString();
};

const textWithBreaks = (value: string): string => escapeHtml(value).replace(/\n/g, "<br>");

const fillTemplate = (template: string, values: Record<string, string>): string =>
  template.replace(PLACEHOLDER, (match, key: string) => (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match));

const trackButton = (url: string | null, label: string, filled: boolean, color: string): string => {
  if (!url) return "";
  const href = escapeHtml(url);
  const style = filled
    ? `display: block; width: 200px; background-color: ${color}; color: #fff; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; text-align: center;`
    : `display: block; width: 200px; background-color: #fff; color: ${color}; border: 2px solid ${color}; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; text-align: center;`;
  return `<a href="${href}" style="${style}">${escapeHtml(label)}</a>`;
};

const shell = (header: string, headerColor: string, body: string): string => `
      <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: ${headerColor}; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
          <h1 style="color: #fff; margin: 0;">${escapeHtml(header)}</h1>
        </div>
        <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; background-color: #fff;">
          ${body}
        </div>
      </div>
    `;

export type MailTemplateInput = {
  template?: unknown;
  testerNickname?: unknown;
  appName?: unknown;
  category?: unknown;
  iconUrl?: unknown;
  trackLinkAndroid?: unknown;
  trackLinkWeb?: unknown;
  isNudge?: boolean;
};

export const renderMailTemplate = (input: MailTemplateInput): string => {
  const isNudge = input.isNudge === true;
  const nickname = asString(input.testerNickname);
  const appName = asString(input.appName).trim() || "앱";
  const category = asString(input.category).trim() || "App";
  const androidUrl = officialTrackUrl(input.trackLinkAndroid, "android");
  const webUrl = officialTrackUrl(input.trackLinkWeb, "web");
  const header = isNudge ? "GOOTE REMINDER" : "GOOTE";
  const headerColor = isNudge ? "#be123c" : "#0f172a";
  const accent = isNudge ? "#be123c" : "#0f172a";
  const buttons = `
          <div style="margin: 30px 0; display: flex; flex-direction: column; gap: 12px; align-items: center;">
            ${trackButton(androidUrl, isNudge ? "Android로 지금 인증" : "Android로 실행하기", true, accent)}
            ${trackButton(webUrl, isNudge ? "Web으로 지금 인증" : "Web으로 실행하기", false, accent)}
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            * 버튼을 클릭하면 자동으로 오늘 참여 현황이 업데이트되며 플레이스토어로 이동합니다.<br>
            * 앱을 실행한 후 1분 이상 사용해주시는 것이 좋습니다.
          </p>`;

  const template = asString(input.template).trim();
  if (!template) {
    const subtitle = isNudge
      ? `${escapeHtml(nickname)}님, 테스트 참여를 잊으셨나요?`
      : `안녕하세요, ${escapeHtml(nickname)}님!`;
    const message = isNudge
      ? `${escapeHtml(nickname)}님, 테스트 참여를 잊으셨나요? 연속 참여 기록을 유지하기 위해 오늘 안에 앱을 실행해주세요!`
      : "오늘의 테스트 참여 시간입니다. 아래 버튼을 눌러 앱을 실행해주세요.";
    const icon = safeIconUrl(input.iconUrl);
    const iconHtml = icon
      ? `<img src="${escapeHtml(icon)}" alt="" style="width: 50px; height: 50px; border-radius: 12px;">`
      : "";
    const appColor = isNudge ? "#e11d48" : "#64748b";
    const appBg = isNudge ? "#fff1f2" : "#f8fafc";
    const appBorder = isNudge ? "#ffe4e6" : "#f1f5f9";
    return shell(header, headerColor, `
          <h2 style="font-size: 20px; font-weight: 800; margin-top: 0;">${subtitle}</h2>
          <p>${message}</p>
          <div style="background-color: ${appBg}; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid ${appBorder};">
            <p style="margin-top: 0; font-weight: 700; color: ${appColor}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">대상 앱 정보</p>
            <div style="display: flex; align-items: center; gap: 15px;">
              ${iconHtml}
              <div>
                <p style="margin: 0; font-weight: 800; font-size: 18px;">${escapeHtml(appName)}</p>
                <p style="margin: 2px 0 0; color: ${appColor}; font-size: 14px;">${escapeHtml(category)}</p>
              </div>
            </div>
          </div>
          ${buttons}`);
  }

  const rendered = textWithBreaks(fillTemplate(template, {
    testerNickname: nickname,
    appName,
    trackLinkAndroid: androidUrl || "{trackLinkAndroid}",
    trackLinkWeb: webUrl || "{trackLinkWeb}",
  }));

  return shell(header, headerColor, `
          <div style="font-size: 16px; line-height: 1.6;">${rendered}</div>
          ${buttons}`);
};

export const renderParticipationEmail = (input: {
  testerNickname?: unknown;
  testerEmail?: unknown;
  appName?: unknown;
  manageUrl?: unknown;
}): string => {
  const nickname = escapeHtml(oneLineText(input.testerNickname, "테스터"));
  const email = escapeHtml(oneLineText(input.testerEmail, "이메일 없음"));
  const appName = escapeHtml(oneLineText(input.appName, "앱"));
  const manageUrl = officialAppUrl(input.manageUrl, "/my-apps/");
  const button = manageUrl
    ? `<a href="${escapeHtml(manageUrl)}" style="display: block; background-color: #0f172a; color: #fff; padding: 18px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; margin-bottom: 12px;">앱 관리 페이지에서 확인하기</a>`
    : "";
  return `
        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="background-color: #0f172a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 900;">GOOTE</h1>
            <p style="color: #94a3b8; margin: 10px 0 0; font-size: 14px;">Premium App Testing Community</p>
          </div>
          <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; background-color: #fff;">
            <h2 style="font-size: 20px; font-weight: 800; margin-top: 0;">새로운 테스트 참여자</h2>
            <p style="font-size: 16px;"><strong>${nickname}</strong>님이 <strong>${appName}</strong> 테스트에 참여를 시작했습니다.</p>
            <div style="background-color: #f8fafc; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <p style="margin-top: 0; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">테스터 정보</p>
              <p style="margin: 8px 0;">닉네임: <strong>${nickname}</strong></p>
              <p style="margin: 8px 0;">이메일: <strong>${email}</strong></p>
            </div>
            <div style="margin: 30px 0; text-align: center;">${button}</div>
          </div>
        </div>
      `;
};

export const renderApprovalEmail = (input: {
  testerNickname?: unknown;
  appName?: unknown;
  trackLink?: unknown;
}): string => {
  const nickname = escapeHtml(oneLineText(input.testerNickname, "테스터"));
  const appName = escapeHtml(oneLineText(input.appName, "앱"));
  const trackLink = officialTrackUrl(input.trackLink, "approval");
  const button = trackLink
    ? `<a href="${escapeHtml(trackLink)}" style="background-color: #0f172a; color: #fff; padding: 18px 30px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; display: inline-block;">설치하고 오늘 참여 반영하기</a>`
    : "";
  return `
        <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background-color: #0f172a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
            <h1 style="color: #fff; margin: 0;">GOOTE</h1>
          </div>
          <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px;">
            <h2>참여 승인 완료!</h2>
            <p>${nickname}님, <strong>${appName}</strong> 테스트 참여가 승인되었습니다.</p>
            <div style="margin: 30px 0; text-align: center;">${button}</div>
          </div>
        </div>
      `;
};

export const renderCommentEmail = (input: {
  commenterName?: unknown;
  appName?: unknown;
  content?: unknown;
  commentLink?: unknown;
}): string => {
  const commenterName = escapeHtml(oneLineText(input.commenterName, "익명"));
  const appName = escapeHtml(oneLineText(input.appName, "앱"));
  const content = textWithBreaks(asString(input.content));
  const commentLink = officialAppUrl(input.commentLink, "/apps/");
  const button = commentLink
    ? `<a href="${escapeHtml(commentLink)}" style="display: inline-block; background-color: #0f172a; color: #fff; padding: 18px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px;">앱 페이지에서 확인하기</a>`
    : "";
  return `
        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="background-color: #0f172a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 900;">GOOTE</h1>
          </div>
          <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; background-color: #fff;">
            <h2 style="font-size: 20px; font-weight: 800; margin-top: 0;">새로운 피드백이 도착했습니다.</h2>
            <p style="font-size: 16px;"><strong>${commenterName}</strong>님이 <strong>${appName}</strong>에 댓글을 남겼습니다.</p>
            <div style="background-color: #f8fafc; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <p style="margin: 0;">${content}</p>
            </div>
            <div style="margin: 30px 0; text-align: center;">${button}</div>
          </div>
        </div>
      `;
};
