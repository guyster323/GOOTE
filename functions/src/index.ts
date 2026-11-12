import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { google } from "googleapis";
import { sendGmail } from "./utils/gmail";
import { randomBytes } from "crypto";
import type { Request, Response } from "express";

const playOAuth2Client = () => new google.auth.OAuth2(
  process.env.GOOGLE_PLAY_OAUTH_CLIENT_ID,
  process.env.GOOGLE_PLAY_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_PLAY_OAUTH_REDIRECT_URI
);

const PLAY_PACKAGE_VERIFY_SCOPES = [
  "https://www.googleapis.com/auth/androidpublisher",
  "https://www.googleapis.com/auth/userinfo.email"
];

type PlayConnectionDocument = {
  ownerId: string;
  email: string;
  refreshToken: string;
  scope: string;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
};

type PlayPackageVerification = {
  packageName: string;
  title: string;
  verified: boolean;
  status: "verified" | "not-found" | "forbidden";
  detail: string;
};

const getPlayConnectionRef = (uid: string) => db.collection("playConsoleConnections").doc(uid);
const getPlayAuthStateRef = (state: string) => db.collection("playConsoleAuthStates").doc(state);

const sanitizePlayConnectionConfig = () => {
  const clientId = (process.env.GOOGLE_PLAY_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_PLAY_OAUTH_CLIENT_SECRET || "").trim();
  const redirectUri = (process.env.GOOGLE_PLAY_OAUTH_REDIRECT_URI || "").trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new functions.https.HttpsError("failed-precondition", "Play Console OAuth 환경 변수가 설정되지 않았습니다.");
  }
  return { clientId, clientSecret, redirectUri };
};

const getPlayConnection = async (uid: string) => {
  const snap = await getPlayConnectionRef(uid).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as PlayConnectionDocument | undefined;
};

const buildPlayConnectionStatus = async (uid: string) => {
  const connection = await getPlayConnection(uid);
  return {
    connected: Boolean(connection?.refreshToken),
    email: connection?.email || "",
    updatedAt: connection?.updatedAt || null
  };
};

const getPlayOAuthStartUrl = (draftId: string, uid: string) => {
  sanitizePlayConnectionConfig();
  const state = randomBytes(24).toString("hex");
  const oauth = playOAuth2Client();
  const authUrl = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    scope: PLAY_PACKAGE_VERIFY_SCOPES,
    state
  });
  return { authUrl, state, draftId, uid };
};

const getPlayAuthedOAuthClient = async (uid: string) => {
  sanitizePlayConnectionConfig();
  const connection = await getPlayConnection(uid);
  if (!connection?.refreshToken) {
    throw new functions.https.HttpsError("failed-precondition", "Play Console 계정 연결이 필요합니다.");
  }
  const oauth = playOAuth2Client();
  oauth.setCredentials({ refresh_token: connection.refreshToken });
  return oauth;
};

const getPlayAuthedPublisher = async (uid: string) => {
  const oauth = await getPlayAuthedOAuthClient(uid);
  return google.androidpublisher({ version: "v3", auth: oauth });
};

const safePlayApiError = (error: any) => ({
  message: typeof error?.message === "string" ? error.message : "Unknown Play API error.",
  status: Number(error?.code || error?.response?.status || 0) || null,
  data: error?.response?.data || null,
});

const inspectPlayPackageApi = async (uid: string, packageName: string) => {
  const normalizedPackageName = sanitizeRequiredPackageName(packageName);
  const oauth = await getPlayAuthedOAuthClient(uid);
  const publisher = google.androidpublisher({ version: "v3", auth: oauth });
  const edit = await publisher.edits.insert({ packageName: normalizedPackageName });
  const editId = edit.data.id || "";

  if (!editId) {
    throw new functions.https.HttpsError("internal", "Play inspection edit ID를 만들지 못했습니다.");
  }

  try {
    let tracksPayload: any = null;
    let trackListError: ReturnType<typeof safePlayApiError> | null = null;
    let tracks: any[] = [];

    try {
      const tracksResponse = await publisher.edits.tracks.list({
        packageName: normalizedPackageName,
        editId,
      });
      tracksPayload = tracksResponse.data || null;
      tracks = Array.isArray(tracksResponse.data?.tracks) ? tracksResponse.data.tracks : [];
    } catch (error: any) {
      trackListError = safePlayApiError(error);
    }

    const testersByTrack = await Promise.all(
      tracks.map(async (track: any) => {
        const trackName = typeof track?.track === "string" ? track.track.trim() : "";
        if (!trackName) {
          return null;
        }

        try {
          const testersResponse = await oauth.request<any>({
            url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(normalizedPackageName)}/edits/${encodeURIComponent(editId)}/testers/${encodeURIComponent(trackName)}`,
            method: "GET",
          });
          return {
            track: trackName,
            ok: true,
            testers: testersResponse.data || null,
          };
        } catch (error: any) {
          return {
            track: trackName,
            ok: false,
            error: safePlayApiError(error),
          };
        }
      })
    );

    const releasesByTrack = tracks
      .map((track: any) => {
        const trackName = typeof track?.track === "string" ? track.track.trim() : "";
        if (!trackName) {
          return null;
        }

        return {
          track: trackName,
          ok: true,
          releases: {
            track: trackName,
            releases: Array.isArray(track?.releases) ? track.releases : [],
          },
        };
      })
      .filter(Boolean);

    return {
      packageName: normalizedPackageName,
      editId,
      tracks: tracksPayload,
      trackListError,
      testersByTrack: testersByTrack.filter(Boolean),
      releasesByTrack,
    };
  } finally {
    try {
      await publisher.edits.delete({ packageName: normalizedPackageName, editId });
    } catch {
      // no-op cleanup
    }
  }
};

const configureSharedTesterGroupApi = async (uid: string, packageName: string, trackName: string, googleGroupEmail = SHARED_TESTER_GROUP_EMAIL) => {
  const normalizedPackageName = sanitizeRequiredPackageName(packageName);
  const normalizedTrackName = sanitizeRequiredTestingTrackName(trackName);
  const normalizedGoogleGroupEmail = sanitizeRequiredGoogleGroupEmail(googleGroupEmail);
  const oauth = await getPlayAuthedOAuthClient(uid);
  const publisher = google.androidpublisher({ version: "v3", auth: oauth });
  const edit = await publisher.edits.insert({ packageName: normalizedPackageName });
  const editId = edit.data.id || "";
  let committed = false;

  if (!editId) {
    throw new functions.https.HttpsError("internal", "Play testers edit ID를 만들지 못했습니다.");
  }

  try {
    await oauth.request<any>({
      url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(normalizedPackageName)}/edits/${encodeURIComponent(editId)}/testers/${encodeURIComponent(normalizedTrackName)}`,
      method: "PATCH",
      data: {
        googleGroups: [normalizedGoogleGroupEmail],
      },
    });
    await publisher.edits.commit({ packageName: normalizedPackageName, editId });
    committed = true;
    return inspectPlayPackageApi(uid, normalizedPackageName);
  } finally {
    if (!committed) {
      try {
        await publisher.edits.delete({ packageName: normalizedPackageName, editId });
      } catch {
        // no-op cleanup
      }
    }
  }
};

const getReleaseBundleObjectName = (packageName: string) =>
  `release-bundles/${packageName}/app-release-0.1.1-2.aab`;

const uploadReleaseBundleToTestingTrackApi = async (uid: string, packageName: string, trackName: string) => {
  const normalizedPackageName = sanitizeRequiredPackageName(packageName);
  const normalizedTrackName = sanitizeRequiredTestingTrackName(trackName);
  const oauth = await getPlayAuthedOAuthClient(uid);
  const publisher = google.androidpublisher({ version: "v3", auth: oauth });
  const edit = await publisher.edits.insert({ packageName: normalizedPackageName });
  const editId = edit.data.id || "";
  let committed = false;

  if (!editId) {
    throw new functions.https.HttpsError("internal", "Play release edit ID를 만들지 못했습니다.");
  }

  try {
    const objectName = getReleaseBundleObjectName(normalizedPackageName);
    const file = admin.storage().bucket().file(objectName);
    const [exists] = await file.exists();
    if (!exists) {
      throw new functions.https.HttpsError("failed-precondition", `Release AAB가 Storage에 없습니다: ${objectName}`);
    }

    const bundle = await publisher.edits.bundles.upload({
      packageName: normalizedPackageName,
      editId,
      media: {
        mimeType: "application/octet-stream",
        body: file.createReadStream(),
      },
    } as any);
    const versionCode = String(bundle.data.versionCode || "").trim();
    if (!versionCode) {
      throw new functions.https.HttpsError("internal", "Play bundle 업로드 응답에서 versionCode를 확인하지 못했습니다.");
    }

    await publisher.edits.tracks.update({
      packageName: normalizedPackageName,
      editId,
      track: normalizedTrackName,
      requestBody: {
        track: normalizedTrackName,
        releases: [
          {
            name: "GOOTE 0.1.1",
            versionCodes: [versionCode],
            status: "draft",
            releaseNotes: [
              {
                language: "ko-KR",
                text: "GOOTE closed testing draft release.",
              },
            ],
          },
        ],
      },
    } as any);
    await publisher.edits.commit({ packageName: normalizedPackageName, editId });
    committed = true;

    return {
      versionCode,
      inspection: await inspectPlayPackageApi(uid, normalizedPackageName),
    };
  } finally {
    if (!committed) {
      try {
        await publisher.edits.delete({ packageName: normalizedPackageName, editId });
      } catch {
        // no-op cleanup
      }
    }
  }
};

const verifyPlayPackageAccess = async (uid: string, packageName: string): Promise<PlayPackageVerification> => {
  const normalizedPackageName = sanitizeRequiredPackageName(packageName);
  const publisher = await getPlayAuthedPublisher(uid);

  try {
    const edit = await publisher.edits.insert({ packageName: normalizedPackageName });
    const editId = edit.data.id || "";
    let title = normalizedPackageName;

    if (editId) {
      try {
        const listing = await publisher.edits.listings.get({
          packageName: normalizedPackageName,
          editId,
          language: "en-US"
        });
        title = (listing.data.title || "").trim() || normalizedPackageName;
      } catch {
        title = normalizedPackageName;
      }

      try {
        await publisher.edits.delete({ packageName: normalizedPackageName, editId });
      } catch {
        // no-op cleanup
      }
    }

    return {
      packageName: normalizedPackageName,
      title,
      verified: true,
      status: "verified",
      detail: "Play Console package access verified."
    };
  } catch (error: any) {
    const status = Number(error?.code || error?.response?.status || 0);
    if (status === 403) {
      return {
        packageName: normalizedPackageName,
        title: "",
        verified: false,
        status: "forbidden",
        detail: "이 Google 계정으로 해당 패키지에 접근할 수 없습니다."
      };
    }
    return {
      packageName: normalizedPackageName,
      title: "",
      verified: false,
      status: "not-found",
      detail: "해당 패키지를 Play Console에서 찾지 못했습니다."
    };
  }
};

const applyVerifiedPlayPackageToDraft = async (uid: string, draftId: string, packageName: string) => {
  const verification = await verifyPlayPackageAccess(uid, packageName);
  if (!verification.verified) {
    throw new functions.https.HttpsError("failed-precondition", verification.detail);
  }

  const { draftRef, draftData } = await getDraftOwnership(draftId, uid);
  const nextPayload = {
    ...draftData.payload,
    packageName: verification.packageName,
    name: verification.title || draftData.payload.name,
    developerConsoleId: ""
  };
  const nextDraft = buildDraftDocument(
    uid,
    nextPayload,
    draftData.googleAccountEmail,
    draftData.stage,
    draftData.finalizedPayload ? { finalizedPayload: draftData.finalizedPayload } : undefined
  );

  await draftRef.set({
    ...nextDraft,
    createdAt: draftData.createdAt,
  }, { merge: true });

  return {
    verification,
    draft: serializeDraft(draftId, {
      ...nextDraft,
      createdAt: draftData.createdAt,
    })
  };
};

const handlePlayConsoleOAuthStart = async (req: Request, res: Response) => {
  const draftId = getRequiredId(req.query.draftId, "draft ID");
  const uid = getRequiredId(req.query.uid, "user ID");
  const callback = typeof req.query.callback === "string" && req.query.callback.trim()
    ? req.query.callback.trim()
    : APP_DRAFT_CALLBACK_URL;
  const { authUrl, state } = getPlayOAuthStartUrl(draftId, uid);
  await getPlayAuthStateRef(state).set({
    draftId,
    uid,
    callback,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.redirect(authUrl);
};

const handlePlayConsoleOAuthCallback = async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  const state = typeof req.query.state === "string" ? req.query.state.trim() : "";
  if (!code || !state) {
    res.status(400).send("Missing OAuth callback parameters.");
    return;
  }

  const stateSnap = await getPlayAuthStateRef(state).get();
  if (!stateSnap.exists) {
    res.status(400).send("OAuth state not found.");
    return;
  }

  const stateData = stateSnap.data() as { draftId: string; uid: string; callback?: string };
  const oauth = playOAuth2Client();
  const tokenResponse = await oauth.getToken(code);
  oauth.setCredentials(tokenResponse.tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth });
  const userInfo = await oauth2.userinfo.get();
  const refreshToken = tokenResponse.tokens.refresh_token || "";

  if (!refreshToken) {
    res.status(400).send("Refresh token was not returned. Reconnect with consent.");
    return;
  }

  await getPlayConnectionRef(stateData.uid).set({
    ownerId: stateData.uid,
    email: normalizeEmail(userInfo.data.email),
    refreshToken,
    scope: (tokenResponse.tokens.scope || "").trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await getPlayAuthStateRef(state).delete();
  const callbackBase = stateData.callback || APP_DRAFT_CALLBACK_URL;
  const join = callbackBase.includes("?") ? "&" : "?";
  res.redirect(`${callbackBase}${join}draftId=${encodeURIComponent(stateData.draftId)}&status=play-connected`);
};

const handlePlayConsoleApi = async (req: Request, res: Response) => {
  if (req.method === "GET" && req.path === "/play-console/oauth/start") {
    await handlePlayConsoleOAuthStart(req, res);
    return;
  }
  if (req.method === "GET" && req.path === "/play-console/oauth/callback") {
    await handlePlayConsoleOAuthCallback(req, res);
    return;
  }
};

void handlePlayConsoleApi;

admin.initializeApp();

const db = admin.firestore();

// Max timeout for cold starts and heavy operations
const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 540,
  memory: "512MB"
};

const createNotification = async (
  userId: string,
  type: "tester_joined" | "like_received" | "feedback_created",
  title: string,
  content: string,
  link: string,
  extraData?: any
) => {
  if (!userId) return;
  try {
    await db.collection("notifications").add({
      userId,
      type,
      title,
      content,
      link,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: extraData || null,
    });
    functions.logger.info("Notification created successfully", { userId, type });
  } catch (error) {
    functions.logger.error("Error creating notification", error);
  }
};

const renderMailTemplate = (
  template: string | undefined,
  data: {
    testerNickname: string;
    appName: string;
    trackLinkAndroid: string;
    trackLinkWeb: string;
    iconUrl?: string;
    category?: string;
  },
  isNudge = false
): string => {
  if (!template || !template.trim()) {
    const headerBgColor = isNudge ? "#be123c" : "#0f172a";
    const headerText = isNudge ? "GOOTE REMINDER" : "GOOTE";
    const subtitle = isNudge
      ? "오늘의 참여가 아직 확인되지 않았습니다."
      : `안녕하세요, ${data.testerNickname}님!`;
    const message = isNudge
      ? `${data.testerNickname}님, 테스트 참여를 잊으셨나요? 연속 참여 기록을 유지하기 위해 오늘 안에 앱을 실행해주세요!`
      : "오늘의 테스트 참여 시간입니다. 아래 버튼을 눌러 앱을 실행해주세요.";
    const appColor = isNudge ? "#e11d48" : "#64748b";
    const appBg = isNudge ? "#fff1f2" : "#f8fafc";
    const appBorder = isNudge ? "#ffe4e6" : "#f1f5f9";
    const btnColor = isNudge ? "#be123c" : "#0f172a";

    return `
      <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: ${headerBgColor}; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
          <h1 style="color: ${headerText === "GOOTE" ? "#fff" : "#fff"}; margin: 0;">${headerText}</h1>
        </div>
        <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; background-color: #fff;">
          <h2 style="font-size: 20px; font-weight: 800; margin-top: 0;">${subtitle}</h2>
          <p>${message}</p>

          <div style="background-color: ${appBg}; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid ${appBorder};">
            <p style="margin-top: 0; font-weight: 700; color: ${appColor}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">대상 앱 정보</p>
            <div style="display: flex; align-items: center; gap: 15px;">
              ${data.iconUrl ? `<img src="${data.iconUrl}" style="width: 50px; height: 50px; border-radius: 12px;" />` : ""}
              <div>
                <p style="margin: 0; font-weight: 800; font-size: 18px;">${data.appName}</p>
                <p style="margin: 2px 0 0; color: ${appColor}; font-size: 14px;">${data.category || "App"}</p>
              </div>
            </div>
          </div>

          <div style="margin: 30px 0; display: flex; flex-direction: column; gap: 12px; align-items: center;">
            <a href="${data.trackLinkAndroid}" style="display: block; width: 200px; background-color: ${btnColor}; color: #fff; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; text-align: center;">
              Android로 ${isNudge ? "지금 인증" : "실행하기"}
            </a>
            <a href="${data.trackLinkWeb}" style="display: block; width: 200px; background-color: #fff; color: ${btnColor}; border: 2px solid ${btnColor}; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; text-align: center;">
              Web으로 ${isNudge ? "지금 인증" : "실행하기"}
            </a>
          </div>

          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            * 버튼을 클릭하면 자동으로 오늘 참여 현황이 업데이트되며 플레이스토어로 이동합니다.<br/>
            * 앱을 실행한 후 1분 이상 사용해주시는 것이 좋습니다.
          </p>
        </div>
      </div>
    `;
  }

  const rendered = template
    .replace(/{testerNickname}/g, data.testerNickname)
    .replace(/{appName}/g, data.appName)
    .replace(/{trackLinkAndroid}/g, data.trackLinkAndroid)
    .replace(/{trackLinkWeb}/g, data.trackLinkWeb);

  return `
    <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #0f172a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
        <h1 style="color: #fff; margin: 0;">GOOTE</h1>
      </div>
      <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; background-color: #fff; font-size: 16px; line-height: 1.6;">
        ${rendered}
      </div>
    </div>
  `;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAIL_SEND_CONCURRENCY = 5;
type DailyTrackType = "android" | "web" | "approval";
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const USER_ROLE = "user";
const ADMIN_ROLE = "admin";
const MAX_ID_LENGTH = 200;
const MAX_URL_LENGTH = 2048;
const MAX_APP_NAME_LENGTH = 100;
const MAX_APP_DESCRIPTION_LENGTH = 2000;
const MAX_PACKAGE_NAME_LENGTH = 200;
const MAX_DEVELOPER_NICKNAME_LENGTH = 100;
const MAX_DEVELOPER_CONSOLE_ID_LENGTH = 200;
const APP_CATEGORIES = ["game", "utility", "productivity", "other"] as const;
type AppCategory = (typeof APP_CATEGORIES)[number];

type AppInput = {
  mailTemplate?: string;
  name: string;
  androidParticipationLink: string;
  webParticipationLink: string;
  googleGroupEmail: string;
  googleGroupLink: string;
  googleGroupsAccountConfirmed: boolean;
  packageName: string;
  developerConsoleId: string;
  description: string;
  category: AppCategory;
  testDuration: number;
  minTesters: number;
};

type ClosedTestingGroupCheck = {
  track: string;
  configured: boolean;
  matchedSharedGroup: boolean;
  foundEmails: string[];
  status: "matched" | "mismatch" | "unverified";
  detail: string;
};

type AppDraftStage = "draft" | "started" | "ready-for-finalize" | "finalized";

type GroupsAutomationStatus = {
  mode: "automatic_available" | "manual_required";
  reason: "workspace_admin_required" | "gmail_account" | "account_verification_required" | "not_configured";
  detail: string;
};

type AppDraftDocument = {
  ownerId: string;
  stage: AppDraftStage;
  payload: AppInput;
  googleAccountEmail: string;
  callbackUrl: string;
  playConsoleUrls: {
    appDashboardUrl: string | null;
    internalTestingUrl: string | null;
    testersUrl: string | null;
  };
  googleGroupStatus: {
    completed: boolean;
    label: string;
    detail: string;
    updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  };
  closedTestingGroupCheck: ClosedTestingGroupCheck;
  groupsAutomation: GroupsAutomationStatus;
  playConsoleStatus: {
    completed: boolean;
    label: string;
    detail: string;
    updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  };
  checkpoints: Array<{
    key: "connect-google" | "prepare-groups" | "confirm-groups-account" | "prepare-play-console" | "review-goote";
    title: string;
    description: string;
    completed: boolean;
  }>;
  nextActions: string[];
  finalizedPayload?: AppInput;
  finalizedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
};

const buildDefaultClosedTestingGroupCheck = (targetGoogleGroupEmail = SHARED_TESTER_GROUP_EMAIL): ClosedTestingGroupCheck => ({
  track: "",
  configured: false,
  matchedSharedGroup: false,
  foundEmails: [],
  status: "unverified",
  detail: `Play Console의 closed 테스트 트랙 testers 설정에서 ${targetGoogleGroupEmail} 지정 여부를 확인하세요.`,
});

const normalizeEmailList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeEmail(typeof item === "string" ? item : ""))
    .filter((item) => item.length > 0);
};

const isTestingTrackName = (trackName: string) => {
  const normalized = trackName.trim().toLowerCase();
  return normalized === "alpha" ||
    normalized === "beta" ||
    normalized === "internal" ||
    normalized.startsWith("closed") ||
    normalized.includes("closed");
};

const testingTrackRank = (trackName: string) => {
  const normalized = trackName.trim().toLowerCase();
  if (normalized === "alpha" || normalized.startsWith("closed") || normalized.includes("closed")) return 0;
  if (normalized === "internal") return 1;
  if (normalized === "beta") return 2;
  return 9;
};

const buildClosedTestingGroupCheck = (payload: any, targetGoogleGroupEmail = SHARED_TESTER_GROUP_EMAIL): ClosedTestingGroupCheck => {
  const targetEmail = normalizeEmail(targetGoogleGroupEmail) || SHARED_TESTER_GROUP_EMAIL;
  const entries = Array.isArray(payload?.testersByTrack) ? payload.testersByTrack : [];
  const testingEntries = entries
    .filter((entry: any) => isTestingTrackName(typeof entry?.track === "string" ? entry.track : ""))
    .sort((a: any, b: any) =>
      testingTrackRank(typeof a?.track === "string" ? a.track : "") -
      testingTrackRank(typeof b?.track === "string" ? b.track : "")
    );
  const testingEntry = testingEntries.find((entry: any) => {
    const testers = entry?.testers ?? {};
    const rawEmails = [
      ...normalizeEmailList(testers?.googleGroups),
      ...normalizeEmailList(testers?.googleGroupsList),
      ...normalizeEmailList(testers?.emailLists),
    ];
    return rawEmails.includes(targetEmail);
  }) ?? testingEntries[0];

  if (!testingEntry) {
    return {
      track: "",
      configured: false,
      matchedSharedGroup: false,
      foundEmails: [],
      status: "unverified",
      detail: "테스트 track 응답을 아직 확인하지 못했습니다. Play inspection으로 testers 설정을 다시 확인하세요.",
    };
  }

  const track = typeof testingEntry?.track === "string" ? testingEntry.track.trim() : "";
  const testers = testingEntry?.testers ?? {};
  const rawEmails = [
    ...normalizeEmailList(testers?.googleGroups),
    ...normalizeEmailList(testers?.googleGroupsList),
    ...normalizeEmailList(testers?.emailLists),
  ];
  const dedupedEmails = Array.from(new Set(rawEmails));
  const matched = dedupedEmails.includes(targetEmail);

  return {
    track,
    configured: dedupedEmails.length > 0,
    matchedSharedGroup: matched,
    foundEmails: dedupedEmails,
    status: matched ? "matched" : (dedupedEmails.length > 0 ? "mismatch" : "unverified"),
    detail: matched
      ? `${track || "테스트"} track에서 ${targetEmail} 이(가) 확인되었습니다.`
      : dedupedEmails.length > 0
        ? `${track || "테스트"} track testers 설정에서 ${targetEmail} 대신 ${dedupedEmails.join(", ")} 이(가) 확인되었습니다.`
        : `${track || "테스트"} track testers 응답은 받았지만 그룹 이메일을 구조적으로 판독하지 못했습니다.`,
  };
};

const hasSharedGroupConfirmation = (payload: AppInput) => payload.googleGroupsAccountConfirmed === true;

const APP_DRAFT_CALLBACK_URL = "goote://automation/return";
const SHARED_TESTER_GROUP_EMAIL = "goote01@googlegroups.com";

const getDraftRef = (draftId: string) => db.collection("appDrafts").doc(draftId);

const buildDraftStatus = (completed: boolean, label: string, detail: string) => ({
  completed,
  label,
  detail,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const buildGroupsAutomationStatus = (googleAccountEmail: string): GroupsAutomationStatus => {
  const normalizedEmail = normalizeEmail(googleAccountEmail);
  if (!normalizedEmail) {
    return {
      mode: "manual_required",
      reason: "account_verification_required",
      detail: "GOOTE 로그인 계정을 먼저 확인한 뒤 같은 계정으로 Google Groups 작업을 진행하세요.",
    };
  }

  if (normalizedEmail.endsWith("@gmail.com")) {
    return {
      mode: "manual_required",
      reason: "gmail_account",
      detail: `${normalizedEmail} 계정은 Workspace 관리자 자동 생성 대상이 아니므로 모바일 브라우저에서 직접 Google Groups를 준비해야 합니다.`,
    };
  }

  return {
    mode: "manual_required",
    reason: "workspace_admin_required",
    detail: `${normalizedEmail} 계정은 향후 Workspace 관리자 자동 생성 후보일 수 있지만 현재는 수동 fallback으로 Google Groups를 준비해야 합니다.`,
  };
};

const buildDraftCheckpoints = (payload: AppInput) => {
  const targetEmail = getTargetGoogleGroupEmail(payload);
  return [
    {
      key: "connect-google" as const,
      title: "개발자 Google 계정 연결",
      description: "브라우저 복귀 후 draft를 이어받기 위해 계정 연결 상태를 유지합니다.",
      completed: true,
    },
    {
      key: "prepare-groups" as const,
      title: "테스터 그룹 지정",
      description: `${targetEmail} 을(를) Play Console closed 테스트 testers 설정에 지정합니다.`,
      completed: Boolean(payload.googleGroupEmail && payload.googleGroupLink),
    },
    {
      key: "confirm-groups-account" as const,
      title: "closed 테스트 그룹 지정 확인",
      description: `${targetEmail} 을(를) 이 앱의 closed 테스트 track에 지정했는지 확인합니다.`,
      completed: hasSharedGroupConfirmation(payload),
    },
    {
      key: "prepare-play-console" as const,
      title: "Play Console 비공개 테스트 준비",
      description: "Android / Web 참여 링크를 확보합니다.",
      completed: Boolean(payload.androidParticipationLink && payload.webParticipationLink),
    },
    {
      key: "review-goote" as const,
      title: "GOOTE 등록 검토",
      description: "그룹 지정 상태와 참여 링크를 검토하고 최종 등록합니다.",
      completed: false,
    },
  ];
};

const buildClosedTrackUrls = (packageName: string, preferredTrack?: string | null) => {
  const normalizedPackageName = packageName.trim();
  if (!normalizedPackageName) {
    return {
      closedTrackUrl: null,
      closedTestersUrl: null,
    };
  }

  const trackName = (preferredTrack || "closed").trim();
  const baseUrl = `https://play.google.com/console/u/0/developers/-/app/${encodeURIComponent(normalizedPackageName)}/testing/${encodeURIComponent(trackName)}`;
  return {
    closedTrackUrl: baseUrl,
    closedTestersUrl: `${baseUrl}/testers`,
  };
};

const buildDraftConsoleUrls = (payload: AppInput, preferredTrack?: string | null) => {
  const packageName = payload.packageName.trim();

  if (!packageName) {
    return {
      appDashboardUrl: null,
      internalTestingUrl: null,
      testersUrl: null,
    };
  }

  const baseUrl = `https://play.google.com/console/u/0/developers/-/app/${encodeURIComponent(packageName)}`;
  const closedTrackUrls = buildClosedTrackUrls(packageName, preferredTrack);
  return {
    appDashboardUrl: baseUrl,
    internalTestingUrl: closedTrackUrls.closedTrackUrl,
    testersUrl: closedTrackUrls.closedTestersUrl,
  };
};

const resolvePreferredClosedTrack = (inspection?: ClosedTestingGroupCheck) => {
  if (inspection?.track) {
    return inspection.track;
  }
  return "closed";
};

const getTargetGoogleGroupEmail = (payload: Pick<AppInput, "googleGroupEmail">) =>
  normalizeEmail(payload.googleGroupEmail) || SHARED_TESTER_GROUP_EMAIL;

const buildGoogleGroupStatusDetail = (payload: AppInput, inspection?: ClosedTestingGroupCheck) => {
  const targetEmail = getTargetGoogleGroupEmail(payload);
  if (inspection?.status === "matched") {
    return inspection.detail;
  }
  if (inspection?.status === "mismatch") {
    return inspection.detail;
  }
  return hasSharedGroupConfirmation(payload)
    ? `${targetEmail} 을(를) closed 테스트 track에 지정했다고 확인했습니다. 필요하면 Play inspection으로 다시 검증하세요.`
    : `${targetEmail} 을(를) closed 테스트 track testers 설정에 지정했는지 확인 체크가 필요합니다.`;
};

const buildPlayConsoleStatusDetail = (payload: AppInput) => (
  Boolean(payload.androidParticipationLink && payload.webParticipationLink)
    ? "Android / Web 참여 링크가 draft에 반영되었습니다."
    : "Play Console closed 테스트 화면에서 Android / Web 참여 링크를 확보한 뒤 draft에 반영하세요."
);

const buildNextActions = (payload: AppInput, playConsoleUrls: { appDashboardUrl: string | null; internalTestingUrl: string | null; testersUrl: string | null; }, inspection?: ClosedTestingGroupCheck, stage?: AppDraftStage) => {
  const hasPlayValues = Boolean(payload.androidParticipationLink && payload.webParticipationLink);
  const targetEmail = getTargetGoogleGroupEmail(payload);
  return [
    playConsoleUrls.testersUrl
      ? `Play Console closed testers 열기: ${playConsoleUrls.testersUrl}`
      : "패키지 이름을 검증하면 closed testers 바로가기를 생성할 수 있습니다.",
    inspection?.detail || `${targetEmail} 을(를) closed 테스트 testers 설정에 지정했는지 확인하세요.`,
    hasPlayValues
      ? (stage === "finalized"
          ? "finalizedPayload를 createApp에 전달해 최종 등록을 완료하세요."
          : "Android / Web 참여 링크가 준비되었습니다. 최종 검토 후 앱 등록을 완료하세요.")
      : "Play Console closed 테스트 화면에서 Android / Web 참여 링크를 복사해 입력하세요.",
  ];
};

const buildDraftDocument = (
  ownerId: string,
  payload: AppInput,
  googleAccountEmail: string,
  stage: AppDraftStage,
  options?: { finalizedPayload?: AppInput; inspection?: ClosedTestingGroupCheck }
): AppDraftDocument => {
  const normalizedPayload = payload;
  const inspection = options?.inspection ?? buildDefaultClosedTestingGroupCheck(getTargetGoogleGroupEmail(normalizedPayload));
  const playConsoleUrls = buildDraftConsoleUrls(normalizedPayload, resolvePreferredClosedTrack(inspection));
  const groupsAutomation = buildGroupsAutomationStatus(googleAccountEmail);
  const hasAccountConfirmation = hasSharedGroupConfirmation(normalizedPayload);
  const hasPlayValues = Boolean(normalizedPayload.androidParticipationLink && normalizedPayload.webParticipationLink);

  return {
    ownerId,
    stage,
    payload: normalizedPayload,
    googleAccountEmail,
    callbackUrl: APP_DRAFT_CALLBACK_URL,
    playConsoleUrls,
    googleGroupStatus: buildDraftStatus(
      inspection.status === "matched" || hasAccountConfirmation,
      inspection.status === "matched" ? "공용 테스터 그룹 확인 완료" : "공용 테스터 그룹 지정 필요",
      buildGoogleGroupStatusDetail(normalizedPayload, inspection)
    ),
    closedTestingGroupCheck: inspection,
    groupsAutomation,
    playConsoleStatus: buildDraftStatus(
      hasPlayValues,
      hasPlayValues ? "Play Console 확인 완료" : "Play Console 링크 확인 필요",
      buildPlayConsoleStatusDetail(normalizedPayload)
    ),
    checkpoints: buildDraftCheckpoints(normalizedPayload).map((checkpoint) =>
      checkpoint.key === "review-goote" && stage === "finalized"
        ? { ...checkpoint, completed: true }
        : checkpoint
    ),
    nextActions: buildNextActions(normalizedPayload, playConsoleUrls, inspection, stage),
    ...(options?.finalizedPayload ? { finalizedPayload: options.finalizedPayload } : {}),
    ...(stage === "finalized"
      ? { finalizedAt: admin.firestore.FieldValue.serverTimestamp() }
      : {}),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const mergeAppInput = (current: AppInput, patch: Partial<AppInput>): AppInput => ({
  ...current,
  ...patch,
});

const getDraftPrepareInput = (data: any): AppInput => ({
  name: sanitizeOptionalText(data?.name, MAX_APP_NAME_LENGTH),
  androidParticipationLink:
    typeof data?.androidParticipationLink === "string"
      ? sanitizeRequiredHttpsUrl(data.androidParticipationLink, "Android 참여 링크")
      : "",
  webParticipationLink:
    typeof data?.webParticipationLink === "string"
      ? sanitizeRequiredHttpsUrl(data.webParticipationLink, "Web 참여 링크")
      : "",
  googleGroupEmail:
    typeof data?.googleGroupEmail === "string" && getTrimmedString(data.googleGroupEmail)
      ? sanitizeRequiredGoogleGroupEmail(data.googleGroupEmail)
      : getSharedGroupEmail(),
  googleGroupLink:
    typeof data?.googleGroupLink === "string" && getTrimmedString(data.googleGroupLink)
      ? sanitizeRequiredGoogleGroupUrl(data.googleGroupLink)
      : getSharedGroupLink(),
  googleGroupsAccountConfirmed: data?.googleGroupsAccountConfirmed === true,
  packageName:
    typeof data?.packageName === "string" && getTrimmedString(data.packageName)
      ? sanitizeRequiredPackageName(data.packageName)
      : "",
  developerConsoleId: sanitizeOptionalDeveloperConsoleId(data?.developerConsoleId),
  description: sanitizeOptionalText(data?.description, MAX_APP_DESCRIPTION_LENGTH),
  category: sanitizeCategory(data?.category),
  testDuration: sanitizeIntegerInRange(data?.testDuration, "테스트 기간", 7, 30),
  minTesters: sanitizeIntegerInRange(data?.minTesters, "목표 테스터 수", 1, 100),
});

const getDraftPatchInput = (data: any): Partial<AppInput> => {
  const patch: Partial<AppInput> = {};
  if (data?.mailTemplate !== undefined) patch.mailTemplate = sanitizeOptionalText(data.mailTemplate, 4000);

  if (typeof data?.name === "string") patch.name = sanitizeRequiredText(data.name, "앱 이름", MAX_APP_NAME_LENGTH);
  if (typeof data?.androidParticipationLink === "string") patch.androidParticipationLink = sanitizeRequiredHttpsUrl(data.androidParticipationLink, "Android 참여 링크");
  if (typeof data?.webParticipationLink === "string") patch.webParticipationLink = sanitizeRequiredHttpsUrl(data.webParticipationLink, "Web 참여 링크");
  if (typeof data?.googleGroupEmail === "string") patch.googleGroupEmail = sanitizeRequiredGoogleGroupEmail(data.googleGroupEmail);
  if (typeof data?.googleGroupLink === "string") patch.googleGroupLink = sanitizeRequiredGoogleGroupUrl(data.googleGroupLink);
  if (data?.googleGroupsAccountConfirmed !== undefined) patch.googleGroupsAccountConfirmed = data.googleGroupsAccountConfirmed === true;
  if (typeof data?.packageName === "string") patch.packageName = sanitizeRequiredPackageName(data.packageName);
  if (typeof data?.developerConsoleId === "string") patch.developerConsoleId = sanitizeOptionalDeveloperConsoleId(data.developerConsoleId);
  if (typeof data?.description === "string") patch.description = sanitizeOptionalText(data.description, MAX_APP_DESCRIPTION_LENGTH);
  if (typeof data?.category === "string") patch.category = sanitizeCategory(data.category);
  if (data?.testDuration !== undefined) patch.testDuration = sanitizeIntegerInRange(data.testDuration, "테스트 기간", 7, 30);
  if (data?.minTesters !== undefined) patch.minTesters = sanitizeIntegerInRange(data.minTesters, "목표 테스터 수", 1, 100);

  return patch;
};

const getDraftOwnership = async (draftId: string, ownerId: string) => {
  const draftRef = getDraftRef(draftId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) {
    throw new functions.https.HttpsError("not-found", "앱 draft를 찾을 수 없습니다.");
  }
  const draftData = draftSnap.data() as AppDraftDocument | undefined;
  if (!draftData || draftData.ownerId !== ownerId) {
    throw new functions.https.HttpsError("permission-denied", "이 draft에 접근할 권한이 없습니다.");
  }
  return { draftRef, draftData };
};

const createAppFromPayload = async (developerId: string, appInput: AppInput, authContext: functions.https.CallableContext) => {
  const userSnap = await db.collection("users").doc(developerId).get();
  const developerData = userSnap.data();
  const developerNickname = sanitizeRequiredText(
    developerData?.nickname || authContext.auth?.token.name || authContext.auth?.token.email,
    "개발자 닉네임",
    MAX_DEVELOPER_NICKNAME_LENGTH
  );

  const appRef = db.collection("apps").doc();
  await appRef.set({
    ...buildAppPayload(appInput, developerId, developerNickname),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return appRef.id;
};

const serializeDraft = (draftId: string, draftData: AppDraftDocument) => ({
  draftId,
  stage: draftData.stage,
  payload: draftData.payload,
  googleAccountEmail: draftData.googleAccountEmail,
  callbackUrl: draftData.callbackUrl,
  playConsoleUrls: draftData.playConsoleUrls,
  googleGroupStatus: draftData.googleGroupStatus,
  closedTestingGroupCheck: draftData.closedTestingGroupCheck,
  groupsAutomation: draftData.groupsAutomation,
  playConsoleStatus: draftData.playConsoleStatus,
  checkpoints: draftData.checkpoints,
  nextActions: draftData.nextActions,
  finalizedPayload: draftData.finalizedPayload || null,
  finalizedAt: draftData.finalizedAt || null,
});

const buildStartedDraft = (draftData: AppDraftDocument): AppDraftDocument => ({
  ...draftData,
  stage: "started",
  nextActions: [
    draftData.playConsoleUrls.testersUrl
      ? `Play Console closed testers 화면 열기: ${draftData.playConsoleUrls.testersUrl}`
      : "패키지 이름을 검증하면 closed testers 바로가기를 생성할 수 있습니다.",
    draftData.closedTestingGroupCheck.detail,
    `브라우저 작업 후 ${APP_DRAFT_CALLBACK_URL}?draftId={draftId}&status=returned 형태로 GOOTE 앱에 복귀하세요.`,
  ],
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const getSharedGroupEmail = () => SHARED_TESTER_GROUP_EMAIL;
const getSharedGroupLink = () => "https://groups.google.com/g/goote01";

const buildInspectionResponse = (inspection: any, targetGoogleGroupEmail = SHARED_TESTER_GROUP_EMAIL) => ({
  ...inspection,
  closedTestingGroupCheck: buildClosedTestingGroupCheck(inspection, targetGoogleGroupEmail),
});
const buildReadyDraft = (draftData: AppDraftDocument): AppDraftDocument => ({
  ...draftData,
  stage: "ready-for-finalize",
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() ?? "";
const isAdminRole = (role?: string | null) => role === ADMIN_ROLE;
const getBootstrapAdminEmail = () => normalizeEmail(process.env.PRIMARY_ADMIN_EMAIL);
const getInitialUserRole = (email?: string | null) => {
  const bootstrapAdminEmail = getBootstrapAdminEmail();
  return bootstrapAdminEmail && normalizeEmail(email) === bootstrapAdminEmail ? ADMIN_ROLE : USER_ROLE;
};
const getRequiredId = (value: unknown, fieldName: string) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > MAX_ID_LENGTH) {
    throw new functions.https.HttpsError("invalid-argument", `${fieldName}가 올바르지 않습니다.`);
  }
  return normalized;
};
const getUserRoleByUid = async (uid: string) => {
  if (!uid) {
    return USER_ROLE;
  }

  const userSnap = await db.collection("users").doc(uid).get();
  return isAdminRole(userSnap.data()?.role) ? ADMIN_ROLE : USER_ROLE;
};
const assertAdminCaller = async (uid: string) => {
  if (!isAdminRole(await getUserRoleByUid(uid))) {
    throw new functions.https.HttpsError("permission-denied", "관리자만 수행할 수 있습니다.");
  }
};

const getTrimmedString = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isHttpsUrl = (value: string) => {
  if (!value || value.length > MAX_URL_LENGTH) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
const isGoogleGroupUrl = (value: string) => {
  if (!isHttpsUrl(value)) return false;

  try {
    return new URL(value).hostname === "groups.google.com";
  } catch {
    return false;
  }
};
const isGoogleGroupsEmail = (value: string) =>
  /^[^\s@]+@googlegroups\.com$/i.test(value) && value.length <= 254;
const isValidPackageName = (value: string) =>
  value.length > 0 &&
  value.length <= MAX_PACKAGE_NAME_LENGTH &&
  /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value);
const isValidPlayConsoleDeveloperId = (value: string) =>
  value.length > 0 &&
  value.length <= MAX_DEVELOPER_CONSOLE_ID_LENGTH &&
  /^[0-9]+$/.test(value);
const sanitizeOptionalText = (value: unknown, maxLength: number) => {
  const trimmed = getTrimmedString(value);
  if (!trimmed) return "";
  if (trimmed.length > maxLength) {
    throw new functions.https.HttpsError("invalid-argument", `입력값은 ${maxLength}자 이하여야 합니다.`);
  }
  return trimmed;
};
const sanitizeRequiredText = (value: unknown, fieldName: string, maxLength: number) => {
  const trimmed = getTrimmedString(value);
  if (!trimmed) {
    throw new functions.https.HttpsError("invalid-argument", `${fieldName}은(는) 필수입니다.`);
  }
  if (trimmed.length > maxLength) {
    throw new functions.https.HttpsError("invalid-argument", `${fieldName}은(는) ${maxLength}자 이하여야 합니다.`);
  }
  return trimmed;
};
const sanitizeRequiredHttpsUrl = (value: unknown, fieldName: string) => {
  const trimmed = getTrimmedString(value);
  if (!trimmed) {
    throw new functions.https.HttpsError("invalid-argument", `${fieldName}은(는) 필수입니다.`);
  }
  if (!isHttpsUrl(trimmed)) {
    throw new functions.https.HttpsError("invalid-argument", `${fieldName}은(는) https URL이어야 합니다.`);
  }
  return trimmed;
};
const sanitizeRequiredPackageName = (value: unknown) => {
  const trimmed = getTrimmedString(value);
  if (!isValidPackageName(trimmed)) {
    throw new functions.https.HttpsError("invalid-argument", "패키지 이름 형식이 올바르지 않습니다.");
  }
  return trimmed;
};
const sanitizeRequiredGoogleGroupEmail = (value: unknown) => {
  const trimmed = normalizeEmail(getTrimmedString(value));
  if (!isGoogleGroupsEmail(trimmed)) {
    throw new functions.https.HttpsError("invalid-argument", "구글 그룹 이메일은 your-group@googlegroups.com 형식이어야 합니다.");
  }
  return trimmed;
};
const sanitizeRequiredGoogleGroupUrl = (value: unknown) => {
  const trimmed = getTrimmedString(value);
  if (!isGoogleGroupUrl(trimmed)) {
    throw new functions.https.HttpsError("invalid-argument", "구글 그룹 가입 링크는 https://groups.google.com/... 형식이어야 합니다.");
  }
  return trimmed;
};
const sanitizeRequiredTestingTrackName = (value: unknown) => {
  const trimmed = getTrimmedString(value);
  if (!trimmed || trimmed.length > 80 || !/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new functions.https.HttpsError("invalid-argument", "테스트 track 이름 형식이 올바르지 않습니다.");
  }
  if (trimmed.toLowerCase() === "production") {
    throw new functions.https.HttpsError("failed-precondition", "production track에는 공용 테스트 그룹을 자동 적용하지 않습니다.");
  }
  if (!isTestingTrackName(trimmed)) {
    throw new functions.https.HttpsError("failed-precondition", "alpha, beta, internal 또는 closed 테스트 track만 선택할 수 있습니다.");
  }
  return trimmed;
};
const sanitizeOptionalDeveloperConsoleId = (value: unknown) => {
  const trimmed = getTrimmedString(value);
  if (!trimmed) return "";
  if (!isValidPlayConsoleDeveloperId(trimmed)) {
    throw new functions.https.HttpsError("invalid-argument", "Play Console 개발자 ID는 숫자만 입력해야 합니다.");
  }
  return trimmed;
};
const sanitizeIntegerInRange = (value: unknown, fieldName: string, min: number, max: number) => {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    throw new functions.https.HttpsError("invalid-argument", `${fieldName}은(는) ${min} 이상 ${max} 이하의 정수여야 합니다.`);
  }
  return numberValue;
};
const sanitizeCategory = (value: unknown): AppCategory => {
  const normalized = getTrimmedString(value) as AppCategory;
  if (!APP_CATEGORIES.includes(normalized)) {
    throw new functions.https.HttpsError("invalid-argument", "카테고리 값이 올바르지 않습니다.");
  }
  return normalized;
};
const getAppInput = (data: any): AppInput => ({
  ...(data?.mailTemplate === undefined ? {} : { mailTemplate: sanitizeOptionalText(data.mailTemplate, 4000) }),
  name: sanitizeRequiredText(data?.name, "앱 이름", MAX_APP_NAME_LENGTH),
  androidParticipationLink: sanitizeRequiredHttpsUrl(data?.androidParticipationLink, "Android 참여 링크"),
  webParticipationLink: sanitizeRequiredHttpsUrl(data?.webParticipationLink, "Web 참여 링크"),
  googleGroupEmail: sanitizeRequiredGoogleGroupEmail(data?.googleGroupEmail),
  googleGroupLink: sanitizeRequiredGoogleGroupUrl(data?.googleGroupLink),
  googleGroupsAccountConfirmed: data?.googleGroupsAccountConfirmed === true,
  packageName: sanitizeRequiredPackageName(data?.packageName),
  developerConsoleId: sanitizeOptionalDeveloperConsoleId(data?.developerConsoleId),
  description: sanitizeOptionalText(data?.description, MAX_APP_DESCRIPTION_LENGTH),
  category: sanitizeCategory(data?.category),
  testDuration: sanitizeIntegerInRange(data?.testDuration, "테스트 기간", 7, 30),
  minTesters: sanitizeIntegerInRange(data?.minTesters, "목표 테스터 수", 1, 100),
});
const buildAppPayload = (
  appInput: AppInput,
  developerId: string,
  developerNickname: string,
  options?: { preserveStatus?: string; preserveStats?: FirebaseFirestore.DocumentData }
) => ({
  ...appInput,
  developerId,
  developerNickname,
  status: options?.preserveStatus || "recruiting",
  stats: options?.preserveStats || {
    likes: 0,
    participants: 0,
    completedTesters: 0,
    dailyParticipants: 0,
  },
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const getKstDateString = (date: Date) => KST_DATE_FORMATTER.format(date);
const getTodayKstDateString = () => getKstDateString(new Date());
const getYesterdayKstDateString = (baseDate: Date = new Date()) =>
  getKstDateString(new Date(baseDate.getTime() - DAY_MS));
const isDateOnlyString = (value: unknown): value is string =>
  typeof value === "string" && DATE_ONLY_PATTERN.test(value);
const getKstDateMillis = (dateString: string) => new Date(`${dateString}T00:00:00+09:00`).getTime();
const getDateDiffInDays = (earlierDate: string, laterDate: string) =>
  Math.round((getKstDateMillis(laterDate) - getKstDateMillis(earlierDate)) / DAY_MS);


const getProjectId = () => process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "goote-f48d8";
const getApiBaseUrl = () => `https://us-central1-${getProjectId()}.cloudfunctions.net/api`;
const getFunctionsBaseUrl = () => `https://us-central1-${getProjectId()}.cloudfunctions.net`;
const getPlayOAuthStartUrlForApp = (draftId: string, uid: string) => `${getFunctionsBaseUrl()}/api/play-console/oauth/start?draftId=${encodeURIComponent(draftId)}&uid=${encodeURIComponent(uid)}&callback=${encodeURIComponent(APP_DRAFT_CALLBACK_URL)}`;
const getWebAppBaseUrl = () => "https://goote-f48d8.web.app";
const getAppManageUrl = (appId: string) => `${getWebAppBaseUrl()}/my-apps/${encodeURIComponent(appId)}/manage`;
const buildTrackDailyLink = (participationId: string, type: DailyTrackType, token: string) =>
  `${getApiBaseUrl()}/track-daily?pid=${encodeURIComponent(participationId)}&type=${type}&t=${encodeURIComponent(token)}`;

const buildPlayConsoleTestingLink = (appData: FirebaseFirestore.DocumentData | undefined) => {
  const packageName = typeof appData?.packageName === "string"
    ? appData.packageName.trim()
    : "";

  if (!packageName) {
    return "";
  }

  return `https://play.google.com/console/u/0/developers/-/app/${encodeURIComponent(packageName)}/testing/closed`;
};

const isPlayStoreDetailsUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname === "play.google.com" && parsed.pathname === "/store/apps/details";
  } catch {
    return false;
  }
};

const isPlayTestingUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname === "play.google.com" && parsed.pathname.startsWith("/apps/testing/");
  } catch {
    return false;
  }
};

const resolvePlayParticipationLink = (
  type: "android" | "web",
  appData: FirebaseFirestore.DocumentData | undefined
) => {
  const androidLink = typeof appData?.androidParticipationLink === "string"
    ? appData.androidParticipationLink.trim()
    : "";
  const webLink = typeof appData?.webParticipationLink === "string"
    ? appData.webParticipationLink.trim()
    : "";

  if (type === "web") return webLink;
  if (androidLink && isPlayStoreDetailsUrl(androidLink) && isPlayTestingUrl(webLink)) {
    return webLink;
  }
  return androidLink;
};

const ensureDailyTrackToken = async (
  participationRef: FirebaseFirestore.DocumentReference,
  data: FirebaseFirestore.DocumentData | undefined
) => {
  const existingToken = typeof data?.dailyTrackToken === "string" ? data.dailyTrackToken : "";
  if (existingToken) {
    return existingToken;
  }

  const newToken = randomBytes(24).toString("hex");
  await participationRef.update({
    dailyTrackToken: newToken,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return newToken;
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const uniqueDocumentRefs = (refs: FirebaseFirestore.DocumentReference[]) => {
  const refMap = new Map<string, FirebaseFirestore.DocumentReference>();
  refs.forEach((ref) => refMap.set(ref.path, ref));
  return Array.from(refMap.values());
};

const deleteDocumentRefsInChunks = async (refs: FirebaseFirestore.DocumentReference[]) => {
  for (const refChunk of chunkArray(uniqueDocumentRefs(refs), 400)) {
    const batch = db.batch();
    refChunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};
const TERMINAL_APP_STATUSES = new Set([
  "test-completed",
  "terminated",
  "deleted",
  "closed",
  "archived",
]);

const isAppEligibleForMail = (appData: FirebaseFirestore.DocumentData | undefined) => {
  if (!appData) return false;
  if (appData.deletedAt || appData.isDeleted === true) return false;

  const rawStatus = typeof appData.status === "string" ? appData.status.trim().toLowerCase() : "";
  if (!rawStatus) return true;
  return !TERMINAL_APP_STATUSES.has(rawStatus);
};

const getParticipationEndMillis = (data: FirebaseFirestore.DocumentData | undefined) => {
  const explicitEndDate = data?.endDate as admin.firestore.Timestamp | undefined;
  if (explicitEndDate && typeof explicitEndDate.toMillis === "function") {
    return explicitEndDate.toMillis();
  }

  const targetDays = Number(data?.targetDays || 0);
  if (targetDays <= 0) return null;
  const startDate = (data?.startDate || data?.createdAt) as admin.firestore.Timestamp | undefined;
  if (!startDate || typeof startDate.toMillis !== "function") return null;
  return startDate.toMillis() + targetDays * 24 * 60 * 60 * 1000;
};

const closeActiveParticipation = async (
  participationRef: FirebaseFirestore.DocumentReference,
  reason: string,
  endMillis?: number | null
) => {
  const payload: Record<string, any> = {
    status: "completed",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    mailSkipReason: reason,
  };

  if (typeof endMillis === "number" && Number.isFinite(endMillis)) {
    payload.endDate = admin.firestore.Timestamp.fromMillis(endMillis);
  }

  await participationRef.update(payload);
};

const resolveTesterEmail = async (
  participationRef: FirebaseFirestore.DocumentReference,
  data: FirebaseFirestore.DocumentData | undefined
) => {
  if (typeof data?.testerEmail === "string" && data.testerEmail.trim()) {
    return data.testerEmail.trim();
  }

  const testerId = typeof data?.testerId === "string" ? data.testerId : "";
  if (!testerId) return "";

  const testerSnap = await db.collection("users").doc(testerId).get();
  const resolvedEmail = testerSnap.data()?.email;
  if (typeof resolvedEmail === "string" && resolvedEmail.trim()) {
    await participationRef.update({
      testerEmail: resolvedEmail.trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return resolvedEmail.trim();
  }

  return "";
};

const getMailCredentials = () => ({
  clientId: process.env.GMAIL_CLIENT_ID || "",
  clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
  refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
  userEmail: process.env.GMAIL_USER || "",
});

const getDailyCheckDates = (dailyChecks: unknown) => {
  if (!dailyChecks || typeof dailyChecks !== "object") {
    return [] as string[];
  }

  return Object.entries(dailyChecks as Record<string, unknown>)
    .filter(([date, checked]) => isDateOnlyString(date) && Boolean(checked))
    .map(([date]) => date)
    .sort();
};

const hasParticipationCheckedInOnDate = (
  data: FirebaseFirestore.DocumentData | undefined,
  dateString: string
) =>
  Boolean(
    dateString &&
    (data?.lastCheckIn === dateString || (data?.dailyChecks && data.dailyChecks[dateString]))
  );

const getCurrentAttendanceStreak = (attendanceDates: string[], baseDate: Date = new Date()) => {
  if (attendanceDates.length === 0) {
    return 0;
  }

  const uniqueDates = Array.from(new Set(attendanceDates)).sort();
  const lastDate = uniqueDates[uniqueDates.length - 1];
  const today = getKstDateString(baseDate);
  const yesterday = getYesterdayKstDateString(baseDate);

  if (lastDate !== today && lastDate !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let index = uniqueDates.length - 1; index > 0; index -= 1) {
    if (getDateDiffInDays(uniqueDates[index - 1], uniqueDates[index]) !== 1) {
      break;
    }
    streak += 1;
  }

  return streak;
};

const recalculateTesterStats = async (testerId: string) => {
  if (!testerId) return;

  const participationsSnapshot = await db
    .collection("participations")
    .where("testerId", "==", testerId)
    .get();

  let testsJoined = 0;
  let testsCompleted = 0;
  const attendanceDates = new Set<string>();

  participationsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const dailyCheckDates = getDailyCheckDates(data.dailyChecks);

    testsJoined += dailyCheckDates.length;
    dailyCheckDates.forEach((date) => attendanceDates.add(date));

    if (data.status === "completed") {
      testsCompleted += 1;
    }
  });

  await db.collection("users").doc(testerId).set(
    {
      stats: {
        testsJoined,
        testsCompleted,
        totalConsecutiveDays: getCurrentAttendanceStreak(Array.from(attendanceDates)),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Triggered when a new user is created via Firebase Auth.
 * Initializes the user document in the 'users' collection.
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;

  const userDoc: any = {
    uid,
    email: email || "",
    nickname: displayName || email?.split("@")[0] || "User",
    profileImage: photoURL || "",
    role: getInitialUserRole(email),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    stats: {
      appsRegistered: 0,
      testsJoined: 0,
      testsCompleted: 0,
      totalLikes: 0,
      totalConsecutiveDays: 0,
    },
    settings: {
      emailNotifications: true,
    },
  };

  try {
    await db.collection("users").doc(uid).set(userDoc);
    functions.logger.info(`User document created for UID: ${uid}`);
  } catch (error) {
    functions.logger.error(`Error creating user document for UID: ${uid}`, error);
  }
});

// API endpoint placeholder
export const api = functions.runWith(runtimeOpts).https.onRequest(async (req, res) => {
  if (req.path.startsWith("/play-console/oauth/")) {
    await handlePlayConsoleApi(req, res);
    return;
  }
  const path = req.path;

  if (path === "/approve-tester") {
    // Redirect legacy approval links to the dashboard
    const { appId } = req.query;
    if (appId) {
      res.redirect(getAppManageUrl(String(appId)));
    } else {
      res.redirect(`${getWebAppBaseUrl()}/dashboard`);
    }
  } else if (path === "/track-daily") {
    const { pid, t } = req.query;
    const type: DailyTrackType = req.query.type === "web"
      ? "web"
      : req.query.type === "approval"
        ? "approval"
        : "android";

    if (!pid || !t || typeof pid !== "string" || typeof t !== "string") {
      res.status(400).send("Missing pid or token");
      return;
    }

    try {
      const requestDate = new Date();
      const today = getKstDateString(requestDate);
      const yesterday = getYesterdayKstDateString(requestDate);
      const partRef = db.collection("participations").doc(pid);
      const partSnap = await partRef.get();

      if (!partSnap.exists) {
        res.status(404).send("Participation not found");
        return;
      }

      const data = partSnap.data();
      if (!data?.dailyTrackToken || data.dailyTrackToken !== t) {
        res.status(403).send("Invalid track token");
        return;
      }

      const appId = typeof data.appId === "string" ? data.appId : undefined;
      const hasCheckedToday =
        data.lastCheckIn === today ||
        Boolean(data.dailyChecks && data.dailyChecks[today]);

      if (data.status === "active" && !hasCheckedToday) {
        await db.runTransaction(async (tx) => {
          const latestSnap = await tx.get(partRef);
          if (!latestSnap.exists) {
            throw new Error("Participation not found during tracking update");
          }

          const latestData = latestSnap.data();
          if (!latestData?.dailyTrackToken || latestData.dailyTrackToken !== t) {
            throw new Error("Invalid track token during tracking update");
          }

          const alreadyCheckedToday =
            latestData.lastCheckIn === today ||
            Boolean(latestData.dailyChecks && latestData.dailyChecks[today]);

          if (latestData.status !== "active" || alreadyCheckedToday) {
            return;
          }

          const nextConsecutiveDays =
            latestData.lastCheckIn === yesterday
              ? Number(latestData.consecutiveDays || 0) + 1
              : 1;

          tx.update(partRef, {
            [`dailyChecks.${today}`]: true,
            lastCheckIn: today,
            consecutiveDays: nextConsecutiveDays,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (typeof latestData.appId === "string" && latestData.appId) {
            tx.update(db.collection("apps").doc(latestData.appId), {
              "stats.dailyParticipants": admin.firestore.FieldValue.increment(1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        });
      }

      const appSnap = appId ? await db.collection("apps").doc(appId).get() : null;
      const appData = appSnap?.data();
      const redirectUrl = type === "approval"
        ? buildPlayConsoleTestingLink(appData) || appData?.androidParticipationLink
        : type === "web"
          ? resolvePlayParticipationLink("web", appData)
          : resolvePlayParticipationLink("android", appData);

      if (redirectUrl) {
        res.redirect(redirectUrl);
      } else if (appId) {
        res.redirect(`https://goote-f48d8.web.app/apps/${appId}`);
      } else {
        res.redirect(`${getWebAppBaseUrl()}/dashboard`);
      }
    } catch (error) {
      functions.logger.error("Error in track-daily", error);
      res.status(500).send("Internal server error");
    }
  } else {
    res.send("GOOTE API is running.");
  }
});

/**
 * Triggered when a new app is registered.
 * Increments the developer's appsRegistered counter.
 */
export const onAppCreated = functions.firestore
  .document("apps/{appId}")
  .onCreate(async (snapshot, context) => {
    const appData = snapshot.data();
    const developerId = appData?.developerId;

    if (!developerId) {
      functions.logger.error("No developerId found in app document", {appId: context.params.appId});
      return;
    }

    try {
      await db.collection("users").doc(developerId).update({
        "stats.appsRegistered": admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      functions.logger.info(`Incremented appsRegistered for developer: ${developerId}`);
    } catch (error) {
      functions.logger.error(`Error updating developer stats for UID: ${developerId}`, error);
    }
  });

/**
 * Triggered when a new participation is created.
 * Increments the participant count for the app.
 */
export const onParticipationCreated = functions.firestore
  .document("participations/{participationId}")
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const { appId, testerId } = data;

    try {
      const batch = db.batch();

      // 1. Increment app's total participants stats
      const appRef = db.collection("apps").doc(appId);
      batch.update(appRef, {
        "stats.participants": admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();
      await ensureDailyTrackToken(snapshot.ref, data);
      functions.logger.info(`Participation initialized for App: ${appId}, Tester: ${testerId}`);
    } catch (error) {
      functions.logger.error(`Error initializing participation for ID: ${context.params.participationId}`, error);
    }
  });

/**
 * Triggered when a participation is deleted.
 * Decrements the participant count for the app.
 */
export const onParticipationDeleted = functions.firestore
  .document("participations/{participationId}")
  .onDelete(async (snapshot, context) => {
    const data = snapshot.data();
    const appId = data?.appId as string | undefined;

    if (!appId) {
      functions.logger.warn("Participation deleted without appId", { participationId: context.params.participationId });
      return;
    }

    try {
      await db.runTransaction(async (tx) => {
        const appRef = db.collection("apps").doc(appId);
        const appSnap = await tx.get(appRef);
        if (!appSnap.exists) {
          functions.logger.info("Skip participant decrement: app missing", { appId, participationId: context.params.participationId });
          return;
        }

        const currentParticipants = Number(appSnap.data()?.stats?.participants || 0);
        tx.update(appRef, {
          "stats.participants": Math.max(currentParticipants - 1, 0),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      functions.logger.info("Participation removed and participant count decremented", {
        appId,
        participationId: context.params.participationId,
      });
    } catch (error) {
      functions.logger.error(`Error handling participation deletion for ID: ${context.params.participationId}`, error);
    }
  });

/**
 * Recalculates tester stats whenever a participation is created, updated, or deleted.
 */
export const syncTesterStatsOnParticipationWrite = functions.firestore
  .document("participations/{participationId}")
  .onWrite(async (change) => {
    const testerIds = new Set<string>();

    const beforeTesterId = change.before.exists ? change.before.data()?.testerId : undefined;
    const afterTesterId = change.after.exists ? change.after.data()?.testerId : undefined;

    if (typeof beforeTesterId === "string" && beforeTesterId) {
      testerIds.add(beforeTesterId);
    }

    if (typeof afterTesterId === "string" && afterTesterId) {
      testerIds.add(afterTesterId);
    }

    if (testerIds.size === 0) {
      return null;
    }

    try {
      await Promise.all(Array.from(testerIds).map((testerId) => recalculateTesterStats(testerId)));
      return null;
    } catch (error) {
      functions.logger.error("Error syncing tester stats", error);
      return null;
    }
  });

/**
 * Triggered when a new comment is created.
 * Notifies the target app developer by email.
 */
export const onCommentCreated = functions.firestore
  .document("comments/{commentId}")
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const appId = typeof data?.appId === "string" ? data.appId : "";
    const commenterId = typeof data?.userId === "string" ? data.userId : "";
    const commenterName = typeof data?.userName === "string" && data.userName.trim()
      ? data.userName.trim()
      : "익명";
    const content = typeof data?.content === "string" ? data.content.trim() : "";

    if (!appId || !content) {
      functions.logger.warn("Skipping comment notification: missing appId or content", {
        commentId: context.params.commentId,
      });
      return null;
    }

    try {
      const appSnap = await db.collection("apps").doc(appId).get();
      if (!appSnap.exists) {
        functions.logger.warn("Skipping comment notification: app not found", {
          appId,
          commentId: context.params.commentId,
        });
        return null;
      }

      const appData = appSnap.data();
      const developerId = typeof appData?.developerId === "string" ? appData.developerId : "";
      if (!developerId) {
        functions.logger.warn("Skipping comment notification: developerId missing", {
          appId,
          commentId: context.params.commentId,
        });
        return null;
      }

      if (developerId === commenterId) {
        functions.logger.info("Skipping comment notification: developer commented on own app", {
          appId,
          commentId: context.params.commentId,
        });
        return null;
      }

      await createNotification(developerId, "feedback_created", "새로운 피드백 등록", `${commenterName}님이 '${appData?.name || "앱"}'에 피드백을 남겼습니다: ${content.substring(0,30)}`, `/apps/${appId}`, { appId, commenterId, commentId: context.params.commentId });

      const [developerSnap, commenterSnap] = await Promise.all([
        db.collection("users").doc(developerId).get(),
        commenterId ? db.collection("users").doc(commenterId).get() : Promise.resolve(null),
      ]);

      const developerEmail = developerSnap.data()?.email;
      if (typeof developerEmail !== "string" || !developerEmail.trim()) {
        functions.logger.warn("Skipping comment notification: developer email missing", {
          appId,
          developerId,
          commentId: context.params.commentId,
        });
        return null;
      }

      const commenterEmail = commenterSnap?.data()?.email;
      const appName = typeof appData?.name === "string" && appData.name.trim()
        ? appData.name.trim()
        : "앱";
      const commentLink = `${getWebAppBaseUrl()}/apps/${appId}`;
      const credentials = getMailCredentials();
      const subject = `[GOOTE] ${appName}에 새로운 피드백이 등록되었습니다.`;
      const safeContent = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br />");

      const html = `
        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="background-color: #0f172a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 900;">GOOTE</h1>
            <p style="color: #94a3b8; margin: 10px 0 0; font-size: 14px;">New Feedback Alert</p>
          </div>

          <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; background-color: #fff;">
            <h2 style="font-size: 20px; font-weight: 800; margin-top: 0;">새로운 피드백이 도착했습니다.</h2>
            <p style="font-size: 16px;"><strong>${commenterName}</strong>님이 <strong>${appName}</strong>에 댓글을 남겼습니다.</p>

            <div style="background-color: #f8fafc; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <p style="margin-top: 0; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">피드백 내용</p>
              <p style="margin: 0; white-space: normal;">${safeContent}</p>
            </div>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${commentLink}" style="display: inline-block; background-color: #0f172a; color: #fff; padding: 18px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px;">
                앱 페이지에서 확인하기
              </a>
            </div>
          </div>
        </div>
      `;

      await sendGmail({
        to: developerEmail.trim(),
        subject,
        html,
        replyTo: typeof commenterEmail === "string" && commenterEmail.trim() ? commenterEmail.trim() : undefined,
        credentials,
      });

      functions.logger.info("Comment notification email sent", {
        appId,
        developerId,
        commentId: context.params.commentId,
      });

      return null;
    } catch (error) {
      functions.logger.error("Error sending comment notification email", {
        commentId: context.params.commentId,
        appId,
        error,
      });
      return null;
    }
  });

/**
 * Daily refresh to keep tester stats aligned even when no new participation write occurs.
 * Runs every day at 00:05 KST.
 */
export const refreshTesterStatsDaily = functions.pubsub
  .schedule("5 0 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      const usersSnapshot = await db.collection("users").get();
      let processedUsers = 0;

      for (const docs of chunkArray(usersSnapshot.docs, 20)) {
        await Promise.all(docs.map((doc) => recalculateTesterStats(doc.id)));
        processedUsers += docs.length;
      }

      functions.logger.info("refreshTesterStatsDaily completed", { processedUsers });
      return null;
    } catch (error) {
      functions.logger.error("Error refreshing tester stats", error);
      return null;
    }
  });

/**
 * Triggered by HTTPS request to notify developer about a participation request.
 * Creates a pending participation request and notifies the developer.
 */
export const createApp = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const developerId = context.auth.uid;
  const appInput = getAppInput(data);
  const appId = await createAppFromPayload(developerId, appInput, context);

  return { success: true, appId };
});

export const prepareAppDraft = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const developerId = context.auth.uid;
  const appInput = getDraftPrepareInput(data);
  const draftRef = db.collection("appDrafts").doc();
  const draftDoc = buildDraftDocument(
    developerId,
    appInput,
    normalizeEmail(context.auth.token.email),
    "draft"
  );

  await draftRef.set(draftDoc);
  return {
    success: true,
    ...serializeDraft(draftRef.id, draftDoc),
  };
});

export const syncAppDraft = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  const developerId = context.auth.uid;
  const { draftRef, draftData } = await getDraftOwnership(draftId, developerId);
  const mergedPayload = mergeAppInput(draftData.payload, getDraftPatchInput(data));
  const nextStage = mergedPayload.googleGroupEmail &&
    mergedPayload.googleGroupLink &&
    mergedPayload.googleGroupsAccountConfirmed &&
    mergedPayload.androidParticipationLink &&
    mergedPayload.webParticipationLink
    ? "ready-for-finalize"
    : draftData.stage;
  const nextDraft = buildDraftDocument(
    developerId,
    mergedPayload,
    draftData.googleAccountEmail || normalizeEmail(context.auth.token.email),
    nextStage,
    draftData.finalizedPayload ? { finalizedPayload: draftData.finalizedPayload } : undefined
  );

  await draftRef.set({
    ...nextDraft,
    createdAt: draftData.createdAt,
  }, { merge: true });

  return {
    success: true,
    ...serializeDraft(draftId, {
      ...nextDraft,
      createdAt: draftData.createdAt,
    }),
  };
});

export const startHybridAutomation = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  const developerId = context.auth.uid;
  const { draftRef, draftData } = await getDraftOwnership(draftId, developerId);
  const startedDraft = buildStartedDraft(draftData);

  await draftRef.set(startedDraft, { merge: true });
  return {
    success: true,
    launchUrl: draftData.playConsoleUrls.internalTestingUrl || draftData.payload.googleGroupLink || "https://groups.google.com/",
    ...serializeDraft(draftId, startedDraft),
  };
});

export const finalizeAppDraft = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  const developerId = context.auth.uid;
  const { draftRef, draftData } = await getDraftOwnership(draftId, developerId);
  const mergedPayload = mergeAppInput(draftData.payload, getDraftPatchInput(data));
  const finalizedDraft = buildDraftDocument(
    developerId,
    mergedPayload,
    draftData.googleAccountEmail || normalizeEmail(context.auth.token.email),
    "finalized",
    { finalizedPayload: mergedPayload }
  );

  await draftRef.set({
    ...finalizedDraft,
    createdAt: draftData.createdAt,
  }, { merge: true });

  return {
    success: true,
    ...serializeDraft(draftId, {
      ...finalizedDraft,
      createdAt: draftData.createdAt,
    }),
  };
});

export const getAppDraft = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  const developerId = context.auth.uid;
  const { draftData } = await getDraftOwnership(draftId, developerId);

  return {
    success: true,
    ...serializeDraft(draftId, draftData),
  };
});

export const getPlayConsoleConnection = functions.runWith(runtimeOpts).https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  return await buildPlayConnectionStatus(context.auth.uid);
});

export const verifyPlayPackage = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  const packageName = sanitizeRequiredPackageName(data?.packageName);
  const result = await applyVerifiedPlayPackageToDraft(context.auth.uid, draftId, packageName);

  return {
    success: true,
    verification: result.verification,
    ...result.draft,
  };
});

export const getPlayConsoleOAuthStartUrl = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  return {
    success: true,
    url: getPlayOAuthStartUrlForApp(draftId, context.auth.uid),
  };
});

export const listPlayConsoleApps = functions.runWith(runtimeOpts).https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  throw new functions.https.HttpsError(
    "unimplemented",
    "Google Play Developer API는 계정 전체 앱 목록 조회를 직접 제공하지 않아 package 검증 방식으로 진행합니다."
  );
});

export const inspectPlayPackage = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const packageName = sanitizeRequiredPackageName(data?.packageName);
  const googleGroupEmail =
    typeof data?.googleGroupEmail === "string" && getTrimmedString(data.googleGroupEmail)
      ? sanitizeRequiredGoogleGroupEmail(data.googleGroupEmail)
      : SHARED_TESTER_GROUP_EMAIL;

  try {
    const inspection = await inspectPlayPackageApi(context.auth.uid, packageName);
    return {
      success: true,
      inspection: buildInspectionResponse(inspection, googleGroupEmail),
    };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    const safeError = safePlayApiError(error);
    const message = safeError.message || "Play inspection 중 오류가 발생했습니다.";
    if (
      message.includes("Google Play Android Developer API has not been used") ||
      message.includes("androidpublisher.googleapis.com")
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cloud Functions 프로젝트에서 Android Publisher API(androidpublisher.googleapis.com)가 비활성화되어 있습니다. GCP에서 해당 API를 먼저 활성화해야 inspection을 실행할 수 있습니다."
      );
    }
    if (safeError.status === 404 || message.toLowerCase().includes("package not found")) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `${packageName} 패키지를 Android Publisher API에서 찾지 못했습니다. Play Console에서 앱 생성/패키지 등록이 완료되어 있고 현재 연결된 Google 계정에 해당 앱 권한이 있는지 확인해주세요.`
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      `Play inspection 실패: ${message}`
    );
  }
});

export const configureSharedTesterGroup = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const packageName = sanitizeRequiredPackageName(data?.packageName);
  const trackName = sanitizeRequiredTestingTrackName(data?.track);
  const googleGroupEmail =
    typeof data?.googleGroupEmail === "string" && getTrimmedString(data.googleGroupEmail)
      ? sanitizeRequiredGoogleGroupEmail(data.googleGroupEmail)
      : SHARED_TESTER_GROUP_EMAIL;

  try {
    const inspection = await configureSharedTesterGroupApi(context.auth.uid, packageName, trackName, googleGroupEmail);
    return {
      success: true,
      packageName,
      track: trackName,
      googleGroupEmail,
      inspection: buildInspectionResponse(inspection, googleGroupEmail),
    };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    const safeError = safePlayApiError(error);
    const message = safeError.message || "Play testers 설정 중 오류가 발생했습니다.";
    if (safeError.status === 403 || message.toLowerCase().includes("permission")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "현재 연결된 Google 계정에 Play Console testers 설정 권한이 없습니다. 앱 관리자 권한을 확인해주세요."
      );
    }
    if (safeError.status === 404 || message.toLowerCase().includes("package not found")) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `${packageName} 패키지를 Android Publisher API에서 찾지 못했습니다. Play Console 앱 생성과 권한을 다시 확인해주세요.`
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      `Play testers 설정 실패: ${message}`
    );
  }
});

export const uploadPlayBundleToTestingTrack = functions.runWith({
  ...runtimeOpts,
  timeoutSeconds: 540,
  memory: "1GB",
}).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const packageName = sanitizeRequiredPackageName(data?.packageName);
  const trackName = sanitizeRequiredTestingTrackName(data?.track);
  const googleGroupEmail =
    typeof data?.googleGroupEmail === "string" && getTrimmedString(data.googleGroupEmail)
      ? sanitizeRequiredGoogleGroupEmail(data.googleGroupEmail)
      : SHARED_TESTER_GROUP_EMAIL;

  try {
    const result = await uploadReleaseBundleToTestingTrackApi(context.auth.uid, packageName, trackName);
    return {
      success: true,
      packageName,
      track: trackName,
      versionCode: result.versionCode,
      inspection: buildInspectionResponse(result.inspection, googleGroupEmail),
    };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    const safeError = safePlayApiError(error);
    const message = safeError.message || "Play bundle 업로드 중 오류가 발생했습니다.";
    functions.logger.error("uploadPlayBundleToTestingTrack failed", {
      packageName,
      trackName,
      safeError,
    });
    if (safeError.status === 403 || message.toLowerCase().includes("permission")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "현재 연결된 Google 계정에 Play Console release 업로드 권한이 없습니다. 앱 관리자 권한을 확인해주세요."
      );
    }
    if (safeError.status === 409) {
      throw new functions.https.HttpsError(
        "aborted",
        "Play Console edit 충돌이 발생했습니다. 잠시 후 다시 시도하거나 Play Console에서 열린 draft release를 확인해주세요."
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      `Play bundle 업로드 실패: ${message}`
    );
  }
});

export const selectPlayConsoleApp = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  const packageName = sanitizeRequiredPackageName(data?.packageName);
  const result = await applyVerifiedPlayPackageToDraft(context.auth.uid, draftId, packageName);

  return {
    success: true,
    verification: result.verification,
    ...result.draft,
  };
});

export const createAppFromDraft = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  const developerId = context.auth.uid;
  const { draftRef, draftData } = await getDraftOwnership(draftId, developerId);
  const payload = draftData.finalizedPayload || getAppInput(draftData.payload);
  const appId = await createAppFromPayload(developerId, payload, context);

  await draftRef.set({
    stage: "finalized",
    finalizedPayload: payload,
    finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true, appId, draftId };
});

export const markAppDraftReadyForFinalize = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const draftId = getRequiredId(data?.draftId, "draft ID");
  const developerId = context.auth.uid;
  const { draftRef, draftData } = await getDraftOwnership(draftId, developerId);
  const readyDraft = buildReadyDraft(draftData);

  await draftRef.set(readyDraft, { merge: true });
  return {
    success: true,
    ...serializeDraft(draftId, readyDraft),
  };
});

export const createDraft = prepareAppDraft;
export const updateDraft = syncAppDraft;
export const syncDraft = syncAppDraft;
export const getDraft = getAppDraft;
export const startDraftAutomation = startHybridAutomation;
export const markDraftReadyForFinalize = markAppDraftReadyForFinalize;
export const finalizeDraft = finalizeAppDraft;
export const createAppUsingDraft = createAppFromDraft;

export const updateApp = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const appId = getRequiredId(data?.appId, "앱 ID");
  const developerId = context.auth.uid;
  const appInput = getAppInput(data);
  const appRef = db.collection("apps").doc(appId);
  const appSnap = await appRef.get();

  if (!appSnap.exists) {
    throw new functions.https.HttpsError("not-found", "앱을 찾을 수 없습니다.");
  }

  const existingApp = appSnap.data();
  if (existingApp?.developerId !== developerId && !isAdminRole(await getUserRoleByUid(developerId))) {
    throw new functions.https.HttpsError("permission-denied", "앱을 수정할 권한이 없습니다.");
  }

  await appRef.update(buildAppPayload(
    appInput,
    existingApp?.developerId || developerId,
    sanitizeRequiredText(existingApp?.developerNickname || context.auth.token.name || context.auth.token.email, "개발자 닉네임", MAX_DEVELOPER_NICKNAME_LENGTH),
    {
      preserveStatus: typeof existingApp?.status === "string" ? existingApp.status : "recruiting",
      preserveStats: existingApp?.stats,
    }
  ));

  return { success: true, appId };
});

export const requestParticipation = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const appId = getRequiredId(data?.appId, "앱 ID");
  const testerId = context.auth.uid;

  try {
    const [appSnap, testerSnap] = await Promise.all([
      db.collection("apps").doc(appId).get(),
      db.collection("users").doc(testerId).get(),
    ]);

    if (!appSnap.exists) {
      throw new functions.https.HttpsError("not-found", "앱을 찾을 수 없습니다.");
    }

    const appData = appSnap.data();
    if (!isAppEligibleForMail(appData)) {
      throw new functions.https.HttpsError("failed-precondition", "종료되었거나 삭제된 앱은 참여할 수 없습니다.");
    }
    const developerId = appData?.developerId;
    const testerData = testerSnap.data();

    // Deterministic participation document ID prevents duplicate rows per app/tester pair
    const participationId = `${appId}_${testerId}`;
    const participationRef = db.collection("participations").doc(participationId);

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(participationRef);
      if (existing.exists) {
        const status = existing.data()?.status;
        if (status === "active" || status === "completed") {
          throw new functions.https.HttpsError("already-exists", "이미 참여 중인 앱입니다.");
        }
        throw new functions.https.HttpsError("already-exists", "이미 참여 요청을 보냈습니다.");
      }
      const targetDays = Number(appData?.testDuration || 14);
      const startDate = admin.firestore.Timestamp.now();
      const endDate = admin.firestore.Timestamp.fromMillis(startDate.toMillis() + targetDays * 24 * 60 * 60 * 1000);

      tx.create(participationRef, {
        appId,
        appName: appData?.name,
        testerId,
        testerEmail: testerData?.email,
        testerNickname: testerData?.nickname,
        status: "active",
        dailyTrackToken: randomBytes(24).toString("hex"),
        consecutiveDays: 0,
        targetDays,
        startDate,
        endDate,
        lastCheckIn: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Get developer info for email
    const developerSnap = await db.collection("users").doc(developerId).get();
    const developerEmail = developerSnap.data()?.email;

    if (developerEmail) {
      const credentials = {
        clientId: process.env.GMAIL_CLIENT_ID || "",
        clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
        refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
        userEmail: process.env.GMAIL_USER || "",
      };

      const subject = `[GOOTE] ${appData?.name} 테스트에 새로운 참여자가 등록되었습니다.`;

      const html = `
        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="background-color: #0f172a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 900;">GOOTE</h1>
            <p style="color: #94a3b8; margin: 10px 0 0; font-size: 14px;">Premium App Testing Community</p>
          </div>

          <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; background-color: #fff;">
            <h2 style="font-size: 20px; font-weight: 800; margin-top: 0;">새로운 테스트 참여자</h2>
            <p style="font-size: 16px;"><strong>${testerData?.nickname}</strong>님이 <strong>${appData?.name}</strong> 테스트에 참여를 시작했습니다.</p>

            <div style="background-color: #f8fafc; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid #f1f5f9;">
              <p style="margin-top: 0; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">테스터 정보</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 100px;">닉네임</td>
                  <td style="padding: 8px 0; font-weight: 700;">${testerData?.nickname}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">이메일</td>
                  <td style="padding: 8px 0; font-weight: 700;">${testerData?.email}</td>
                </tr>
              </table>
            </div>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${getAppManageUrl(appId)}" style="display: block; background-color: #0f172a; color: #fff; padding: 18px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; margin-bottom: 12px;">
                앱 관리 페이지에서 확인하기
              </a>
            </div>
          </div>
        </div>
      `;

      try {
        await sendGmail({
          to: developerEmail,
          subject,
          html,
          credentials,
          replyTo: testerData?.email
        });
      } catch (mailError) {
        functions.logger.error("Error sending notification email to developer", mailError);
      }
    }

    await createNotification(developerId, "tester_joined", "새로운 테스터 참여", `${testerData?.nickname || "테스터"}님이 '${appData?.name || "앱"}' 테스트에 참여를 시작했습니다.`, `/my-apps/${appId}/manage`, { appId, testerId });

    return { success: true };
  } catch (error: any) {
    functions.logger.error("Error in requestParticipation", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "참여 요청 처리에 실패했습니다.");
  }
});

/**
 * Callable function to create a signed daily tracking link for the authenticated tester.
 */
export const createDailyTrackLink = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const participationId = getRequiredId(data?.participationId, "참여 ID");
  const type = data?.type === "web" ? "web" : data?.type === "android" ? "android" : undefined;

  if (!type) {
    throw new functions.https.HttpsError("invalid-argument", "참여 ID와 타입(android/web)이 필요합니다.");
  }

  const participationRef = db.collection("participations").doc(participationId);
  const participationSnap = await participationRef.get();

  if (!participationSnap.exists) {
    throw new functions.https.HttpsError("not-found", "참여 정보를 찾을 수 없습니다.");
  }

  const participation = participationSnap.data();
  if (participation?.testerId !== context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "해당 참여 링크를 생성할 권한이 없습니다.");
  }

  const token = await ensureDailyTrackToken(participationRef, participation);
  const url = buildTrackDailyLink(participationId, type, token);

  return { url };
});

/**
 * Callable function to delete an app and its related data.
 */
export const deleteApp = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const appId = getRequiredId(data?.appId, "앱 ID");
  const userId = context.auth.uid;

  try {
    // 1. Verify ownership
    const appRef = db.collection("apps").doc(appId);
    const appSnap = await appRef.get();

    if (!appSnap.exists) {
      throw new functions.https.HttpsError("not-found", "앱을 찾을 수 없습니다.");
    }

    const appData = appSnap.data();
    if (appData?.developerId !== userId) {
      throw new functions.https.HttpsError("permission-denied", "삭제 권한이 없습니다.");
    }

    // 2. Delete all participations
    const batch = db.batch();
    const participationsSnap = await db.collection("participations").where("appId", "==", appId).get();

    participationsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 3. Delete all comments
    const commentsSnap = await db.collection("comments").where("appId", "==", appId).get();
    commentsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 4. Delete the app document
    batch.delete(appRef);

    // 5. Decrement user's appsRegistered count
    const userRef = db.collection("users").doc(userId);
    // Note: Use batch.update but handle case where user doc might not exist (unlikely but safe)
    // Actually batch.update requires the doc to exist.
    batch.update(userRef, {
        "stats.appsRegistered": admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    functions.logger.info(`App ${appId} deleted by ${userId}`);
    return { success: true };
  } catch (error: any) {
    functions.logger.error("Error deleting app:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "앱 삭제 중 오류가 발생했습니다.");
  }
});

/**
 * Callable function for developers to approve a tester.
 */
export const deleteUserByAdmin = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  await assertAdminCaller(context.auth.uid);

  const targetUserId = getRequiredId(data?.targetUserId, "탈퇴시킬 사용자 ID");

  if (targetUserId === context.auth.uid) {
    throw new functions.https.HttpsError("failed-precondition", "관리자 본인 계정은 탈퇴시킬 수 없습니다.");
  }

  try {
    const [targetUserSnap, targetParticipationsSnap, targetCommentsSnap, targetLikesSnap, targetNotificationsSnap, targetAppsSnap] = await Promise.all([
      db.collection("users").doc(targetUserId).get(),
      db.collection("participations").where("testerId", "==", targetUserId).get(),
      db.collection("comments").where("userId", "==", targetUserId).get(),
      db.collection("likes").where("fromUserId", "==", targetUserId).get(),
      db.collection("notifications").where("userId", "==", targetUserId).get(),
      db.collection("apps").where("developerId", "==", targetUserId).get(),
    ]);

    let authUser: admin.auth.UserRecord | null = null;
    try {
      authUser = await admin.auth().getUser(targetUserId);
    } catch (error: any) {
      if (error?.code !== "auth/user-not-found") {
        throw error;
      }
    }

    const targetRole = targetUserSnap.data()?.role;
    if (isAdminRole(targetRole)) {
      throw new functions.https.HttpsError("permission-denied", "관리자 계정은 탈퇴시킬 수 없습니다.");
    }

    const ownedAppIds = targetAppsSnap.docs.map((doc) => doc.id);
    const ownedAppRelatedSnapshots = await Promise.all(
      ownedAppIds.flatMap((appId) => [
        db.collection("participations").where("appId", "==", appId).get(),
        db.collection("comments").where("appId", "==", appId).get(),
      ])
    );
    const ownedAppLikeSnapshots = await Promise.all(
      chunkArray(ownedAppIds, 10).map((appIds) => db.collection("likes").where("toId", "in", appIds).get())
    );

    const refsToDelete: FirebaseFirestore.DocumentReference[] = [
      ...targetParticipationsSnap.docs.map((doc) => doc.ref),
      ...targetCommentsSnap.docs.map((doc) => doc.ref),
      ...targetLikesSnap.docs.map((doc) => doc.ref),
      ...targetNotificationsSnap.docs.map((doc) => doc.ref),
      ...targetAppsSnap.docs.map((doc) => doc.ref),
      ...ownedAppRelatedSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref)),
      ...ownedAppLikeSnapshots.flatMap((snapshot) =>
        snapshot.docs
          .filter((doc) => doc.data()?.toType === "app")
          .map((doc) => doc.ref)
      ),
    ];

    if (targetUserSnap.exists) {
      refsToDelete.push(targetUserSnap.ref);
    }

    await deleteDocumentRefsInChunks(refsToDelete);

    if (authUser) {
      await admin.auth().deleteUser(targetUserId);
    }

    functions.logger.info("User deleted by admin", {
      adminUid: context.auth.uid,
      targetUserId,
      deletedDocuments: uniqueDocumentRefs(refsToDelete).length,
      deletedApps: ownedAppIds.length,
    });

    return {
      success: true,
      deletedDocuments: uniqueDocumentRefs(refsToDelete).length,
      deletedApps: ownedAppIds.length,
    };
  } catch (error: any) {
    functions.logger.error("Error deleting user by admin", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "계정 탈퇴 처리 중 오류가 발생했습니다.");
  }
});

export const approveTester = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const participationId = getRequiredId(data?.participationId, "참여 ID");
  const developerId = context.auth.uid;

  try {
    const partRef = db.collection("participations").doc(participationId);
    const partSnap = await partRef.get();

    if (!partSnap.exists) {
      throw new functions.https.HttpsError("not-found", "요청을 찾을 수 없습니다.");
    }

    const participationData = partSnap.data();
    const { appId, testerId } = participationData!;

    // Verify ownership
    const appSnap = await db.collection("apps").doc(appId).get();
    if (!appSnap.exists) {
      throw new functions.https.HttpsError("not-found", "앱을 찾을 수 없습니다.");
    }

    const appData = appSnap.data();
    if (appData?.developerId !== developerId) {
      throw new functions.https.HttpsError("permission-denied", "권한이 없습니다.");
    }

    // Update status
    await partRef.update({
      status: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify tester
    const testerSnap = await db.collection("users").doc(testerId).get();
    const testerData = testerSnap.data();

    if (testerData?.email) {
       const credentials = {
        clientId: process.env.GMAIL_CLIENT_ID || "",
        clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
        refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
        userEmail: process.env.GMAIL_USER || "",
      };

      const token = await ensureDailyTrackToken(partRef, participationData);
      const approvalTrackLink = buildTrackDailyLink(participationId, "approval", token);
      const subject = `[GOOTE] ${appData?.name} 테스트 참여가 승인되었습니다!`;

      const html = `
        <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background-color: #0f172a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
            <h1 style="color: #fff; margin: 0;">GOOTE</h1>
          </div>
          <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px;">
            <h2>참여 승인 완료!</h2>
            <p>${testerData.nickname}님, <strong>${appData?.name}</strong> 테스트 참여가 승인되었습니다.</p>

            <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; font-weight: 700;">테스트 시작하기</p>
              <ol style="margin: 0; padding-left: 20px; color: #475569;">
                <li style="margin-bottom: 8px;">아래 버튼을 눌러 설치 페이지로 이동하면 오늘 참여가 자동 반영됩니다.</li>
                <li style="margin-bottom: 8px;">초대를 수락하고 앱을 다운로드해주세요.</li>
                <li>이후에는 GOOTE의 출석 체크 또는 일일 메일 버튼으로 참여를 이어가세요.</li>
              </ol>
            </div>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${approvalTrackLink}" style="background-color: #0f172a; color: #fff; padding: 18px 30px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; display: inline-block;">
                설치하고 오늘 참여 반영하기
              </a>
            </div>
          </div>
        </div>
      `;

      try {
        await sendGmail({ to: testerData.email, subject, html, credentials });
      } catch (mailError) {
        functions.logger.error("Error sending approval email to tester", mailError);
      }
    }

    return { success: true };
  } catch (error: any) {
    functions.logger.error("Error in approveTester", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "승인 처리에 실패했습니다.");
  }
});

/**
 * Triggered when a participation document is updated.
 * Checks if the test is completed (consecutiveDays >= targetDays).
 */
export const onParticipationUpdated = functions.firestore
  .document("participations/{participationId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();

    // Only process if status is active and consecutiveDays reached targetDays
    if (
      newData.status === "active" &&
      newData.consecutiveDays >= newData.targetDays &&
      (oldData.consecutiveDays < newData.targetDays || oldData.status !== "active")
    ) {
      const { appId } = newData;

      try {
        const batch = db.batch();

        // 1. Update participation status
        const participationRef = db.collection("participations").doc(context.params.participationId);
        batch.update(participationRef, {
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2. Increment app's completedTesters stats
        const appRef = db.collection("apps").doc(appId);
        batch.update(appRef, {
          "stats.completedTesters": admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();
        functions.logger.info(`Participation ${context.params.participationId} marked as completed.`);
      } catch (error) {
        functions.logger.error(`Error processing participation completion for ID: ${context.params.participationId}`, error);
      }
    }
  });

/**
 * Daily scheduler to expire app test periods and active participations.
 * Runs every day at 00:10 KST.
 */
export const expireTestPeriods = functions.runWith(runtimeOpts).pubsub
  .schedule("10 0 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    functions.logger.info("Starting expireTestPeriods scheduler");

    const now = admin.firestore.Timestamp.now();

    try {
      const recruitingAppsSnap = await db.collection("apps").where("status", "==", "recruiting").get();
      const appBatch = db.batch();
      let appUpdates = 0;

      recruitingAppsSnap.docs.forEach((appDoc) => {
        const data = appDoc.data();
        const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;
        const durationDays = Number(data.testDuration || 0);
        if (!createdAt || durationDays <= 0) return;

        const endMillis = createdAt.toMillis() + durationDays * 24 * 60 * 60 * 1000;
        if (now.toMillis() >= endMillis) {
          appBatch.update(appDoc.ref, {
            status: "test-completed",
            testCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          appUpdates += 1;
        }
      });

      if (appUpdates > 0) {
        await appBatch.commit();
      }

      const activeParticipationsSnap = await db.collection("participations").where("status", "==", "active").get();
      const partBatch = db.batch();
      let partUpdates = 0;

      activeParticipationsSnap.docs.forEach((partDoc) => {
        const data = partDoc.data();
        const targetDays = Number(data.targetDays || 0);
        if (targetDays <= 0) return;

        const startDate = (data.startDate || data.createdAt) as admin.firestore.Timestamp | undefined;
        if (!startDate) return;

        const endMillis = startDate.toMillis() + targetDays * 24 * 60 * 60 * 1000;
        if (now.toMillis() >= endMillis) {
          partBatch.update(partDoc.ref, {
            status: "completed",
            endDate: admin.firestore.Timestamp.fromMillis(endMillis),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          partUpdates += 1;
        }
      });

      if (partUpdates > 0) {
        await partBatch.commit();
      }

      functions.logger.info("expireTestPeriods completed", {
        updatedApps: appUpdates,
        updatedParticipations: partUpdates,
      });

      return null;
    } catch (error) {
      functions.logger.error("Error in expireTestPeriods", error);
      return null;
    }
  });

/**
 * Triggered when a like is created.
 * Increments the like counter for the target app or user.
 */
export const onLikeCreated = functions.firestore
  .document("likes/{likeId}")
  .onCreate(async (snapshot, context) => {
    const likeData = snapshot.data();
    const { toType, toId } = likeData;

        try {
      if (toType === "app") {
        await db.collection("apps").doc(toId).update({
          "stats.likes": admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const appSnap = await db.collection("apps").doc(toId).get();
        if (appSnap.exists) {
          const appData = appSnap.data();
          const developerId = appData?.developerId;
          const appName = appData?.name || "앱";
          if (developerId && developerId !== likeData.fromUserId) {
            await createNotification(
              developerId,
              "like_received",
              "새로운 앱 좋아요",
              `${likeData.fromUserNickname || "누군가"}님이 '${appName}' 앱을 좋아합니다.`,
              `/my-apps/${toId}/manage`,
              { appId: toId, fromUserId: likeData.fromUserId }
            );
          }
        }
      } else if (toType === "user") {
        await db.collection("users").doc(toId).update({
          "stats.totalLikes": admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (toId !== likeData.fromUserId) {
          await createNotification(
            toId,
            "like_received",
            "새로운 프로필 좋아요",
            `${likeData.fromUserNickname || "누군가"}님이 회원님을 좋아합니다.`,
            `/ranking`,
            { fromUserId: likeData.fromUserId }
          );
        }
      }
      functions.logger.info(`Incremented likes for ${toType}: ${toId}`);
    } catch (error) {
      functions.logger.error(`Error incrementing likes for ${toType}: ${toId}`, error);
    }
  });

/**
 * Triggered when a like is deleted.
 * Decrements the like counter for the target app or user.
 */
export const onLikeDeleted = functions.firestore
  .document("likes/{likeId}")
  .onDelete(async (snapshot, context) => {
    const likeData = snapshot.data();
    const { toType, toId } = likeData;

    try {
      if (toType === "app") {
        await db.collection("apps").doc(toId).update({
          "stats.likes": admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (toType === "user") {
        await db.collection("users").doc(toId).update({
          "stats.totalLikes": admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      functions.logger.info(`Decremented likes for ${toType}: ${toId}`);
    } catch (error) {
      functions.logger.error(`Error decrementing likes for ${toType}: ${toId}`, error);
    }
  });

/**
 * Weekly scheduler to generate rankings.
 * Runs every Monday at 00:00 KST.
 */
export const weeklyRankingScheduler = functions.pubsub
  .schedule("0 0 * * 1")
  .timeZone("Asia/Seoul")
  .onRun(async (context) => {
    functions.logger.info("Starting weekly ranking generation");

    const now = new Date();
    // Simple week ID: YYYY-WXX (not precise ISO, but enough for ID)
    const weekId = `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2, "0")}`;

    try {
      // 1. Top 10 Apps by Likes
      const topAppsSnapshot = await db
        .collection("apps")
        .orderBy("stats.likes", "desc")
        .limit(10)
        .get();
      const topApps = topAppsSnapshot.docs.map((doc) => ({
        appId: doc.id,
        name: doc.data().name,
        developerNickname: doc.data().developerNickname,
        likes: doc.data().stats.likes || 0,
      }));

      // 2. Top 10 Developers by appsRegistered
      const topDevelopersSnapshot = await db
        .collection("users")
        .orderBy("stats.appsRegistered", "desc")
        .limit(10)
        .get();
      const topDevelopers = topDevelopersSnapshot.docs.map((doc) => ({
        userId: doc.id,
        nickname: doc.data().nickname,
        appsCount: doc.data().stats.appsRegistered || 0,
        completedTests: doc.data().stats.testsCompleted || 0,
        score: (doc.data().stats.appsRegistered || 0) * 10 + (doc.data().stats.testsCompleted || 0),
      }));

      // 3. Top 10 Testers by testsCompleted
      const topTestersSnapshot = await db
        .collection("users")
        .orderBy("stats.testsCompleted", "desc")
        .limit(10)
        .get();
      const topTesters = topTestersSnapshot.docs.map((doc) => ({
        userId: doc.id,
        nickname: doc.data().nickname,
        testsJoined: doc.data().stats.testsJoined || 0,
        totalDays: doc.data().stats.totalConsecutiveDays || 0,
        score: doc.data().stats.testsCompleted || 0,
      }));

      const rankingData = {
        weekId,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        topApps,
        topDevelopers,
        topTesters,
      };

      await db.collection("rankings").doc(weekId).set(rankingData);
      functions.logger.info(`Weekly ranking generated for: ${weekId}`);

      return null;
    } catch (error) {
      functions.logger.error("Error in weeklyRankingScheduler", error);
      return null;
    }
  });

/**
 * Daily scheduler to send reminder emails to active testers.
 * Runs every day at 09:30 KST.
 */
export const dailyTaskMailScheduler = functions.runWith(runtimeOpts).pubsub
  .schedule("30 9 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async (context) => {
    functions.logger.info("Starting 09:30 daily task mail scheduler");

    try {
      const today = getTodayKstDateString();
      const activeParticipationsSnapshot = await db
        .collection("participations")
        .where("status", "==", "active")
        .get();

      if (activeParticipationsSnapshot.empty) {
        return null;
      }

      const credentials = {
        clientId: process.env.GMAIL_CLIENT_ID || "",
        clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
        refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
        userEmail: process.env.GMAIL_USER || "",
      };

      const results: PromiseSettledResult<void>[] = [];

      for (const docs of chunkArray(activeParticipationsSnapshot.docs, MAIL_SEND_CONCURRENCY)) {
        const batchResults = await Promise.allSettled(docs.map(async (doc) => {
          const data = doc.data();
          const participationId = doc.id;
          const { testerNickname, appId } = data;

          if (hasParticipationCheckedInOnDate(data, today)) {
            functions.logger.info("Skipping daily task mail: already checked in this morning", {
              participationId,
              appId,
              today,
            });
            return;
          }

          const endMillis = getParticipationEndMillis(data);
          if (typeof endMillis === "number" && endMillis <= Date.now()) {
            await closeActiveParticipation(doc.ref, "expired-before-mail-send", endMillis);
            functions.logger.info("Skipping daily task mail: participation already expired", { participationId });
            return;
          }

          if (!appId || typeof appId !== "string") {
            functions.logger.warn("Skipping daily task mail: appId missing", { participationId });
            return;
          }

          const appSnap = await db.collection("apps").doc(appId).get();
          const appData = appSnap.data();
          if (!appSnap.exists || !isAppEligibleForMail(appData)) {
            await closeActiveParticipation(doc.ref, "app-not-eligible-for-mail");
            functions.logger.info("Skipping daily task mail: app inactive/deleted", { participationId, appId });
            return;
          }

          const testerEmail = await resolveTesterEmail(doc.ref, data);
          if (!testerEmail) {
            functions.logger.warn("Skipping daily task mail: testerEmail missing", { participationId });
            return;
          }

          const appName = typeof data.appName === "string" && data.appName.trim()
            ? data.appName.trim()
            : typeof appData?.name === "string" && appData.name.trim()
              ? appData.name.trim()
              : "앱";

          const token = await ensureDailyTrackToken(doc.ref, data);
          const trackLinkAndroid = buildTrackDailyLink(participationId, "android", token);
          const trackLinkWeb = buildTrackDailyLink(participationId, "web", token);

          const subject = `[GOOTE] 오늘 ${appName} 앱을 실행하고 참여를 인증해주세요!`;
          const html = renderMailTemplate(appData?.mailTemplate, { testerNickname, appName, trackLinkAndroid, trackLinkWeb, iconUrl: appData?.iconUrl, category: appData?.category }, false);

          try {
            await sendGmail({ to: testerEmail, subject, html, credentials });
          } catch (error) {
            functions.logger.error("Daily task mail delivery failed", { participationId, appId, appName });
            throw error;
          }
        }));
        results.push(...batchResults);
      }

      const failed = results.filter((result) => result.status === "rejected");
      functions.logger.info("dailyTaskMailScheduler finished", {
        total: results.length,
        success: results.length - failed.length,
        failed: failed.length,
      });
      return null;
    } catch (error) {
      functions.logger.error("Error in dailyTaskMailScheduler", error);
      return null;
    }
  });

/**
 * Daily nudge mail for those who haven't checked in yet.
 * Runs every day at 17:30 KST.
 */
export const dailyNudgeMailScheduler = functions.runWith(runtimeOpts).pubsub
  .schedule("30 17 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async (context) => {
    functions.logger.info("Starting 17:30 daily nudge mail scheduler");

    try {
      const today = getTodayKstDateString();
      const activeParticipationsSnapshot = await db
        .collection("participations")
        .where("status", "==", "active")
        .get();

      const credentials = {
        clientId: process.env.GMAIL_CLIENT_ID || "",
        clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
        refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
        userEmail: process.env.GMAIL_USER || "",
      };

      const results: PromiseSettledResult<void>[] = [];

      for (const docs of chunkArray(activeParticipationsSnapshot.docs, MAIL_SEND_CONCURRENCY)) {
        const batchResults = await Promise.allSettled(docs.map(async (doc) => {
          const data = doc.data();
          const hasCheckedToday = hasParticipationCheckedInOnDate(data, today);

          if (hasCheckedToday) return;

          const participationId = doc.id;
          const { testerNickname, appId } = data;

          const endMillis = getParticipationEndMillis(data);
          if (typeof endMillis === "number" && endMillis <= Date.now()) {
            await closeActiveParticipation(doc.ref, "expired-before-mail-send", endMillis);
            functions.logger.info("Skipping daily nudge mail: participation already expired", { participationId });
            return;
          }

          if (!appId || typeof appId !== "string") {
            functions.logger.warn("Skipping daily nudge mail: appId missing", { participationId });
            return;
          }

          const appSnap = await db.collection("apps").doc(appId).get();
          const appData = appSnap.data();
          if (!appSnap.exists || !isAppEligibleForMail(appData)) {
            await closeActiveParticipation(doc.ref, "app-not-eligible-for-mail");
            functions.logger.info("Skipping daily nudge mail: app inactive/deleted", { participationId, appId });
            return;
          }

          const testerEmail = await resolveTesterEmail(doc.ref, data);
          if (!testerEmail) {
            functions.logger.warn("Skipping daily nudge mail: testerEmail missing", { participationId });
            return;
          }

          const appName = typeof data.appName === "string" && data.appName.trim()
            ? data.appName.trim()
            : typeof appData?.name === "string" && appData.name.trim()
              ? appData.name.trim()
              : "앱";

          const token = await ensureDailyTrackToken(doc.ref, data);
          const trackLinkAndroid = buildTrackDailyLink(participationId, "android", token);
          const trackLinkWeb = buildTrackDailyLink(participationId, "web", token);

          const subject = `[GOOTE] 아직 ${appName} 참여 인증을 하지 않으셨네요! (마감 임박)`;
          const html = renderMailTemplate(appData?.mailTemplate, { testerNickname, appName, trackLinkAndroid, trackLinkWeb, iconUrl: appData?.iconUrl, category: appData?.category }, true);

          try {
            await sendGmail({ to: testerEmail, subject, html, credentials });
          } catch (error) {
            functions.logger.error("Daily nudge mail delivery failed", { participationId, appId, appName });
            throw error;
          }
        }));
        results.push(...batchResults);
      }

      const failed = results.filter((result) => result.status === "rejected");
      functions.logger.info("dailyNudgeMailScheduler finished", {
        total: results.length,
        success: results.length - failed.length,
        failed: failed.length,
      });
      return null;
    } catch (error) {
      functions.logger.error("Error in dailyNudgeMailScheduler", error);
      return null;
    }
  });

/**
 * Daily reset for app dailyParticipants.
 * Runs every day at 00:00 KST.
 */
export const resetDailyStats = functions.runWith(runtimeOpts).pubsub
  .schedule("0 0 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async (context) => {
    functions.logger.info("Resetting daily stats");
    try {
      const appsSnapshot = await db.collection("apps").get();
      const batch = db.batch();
      appsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          "stats.dailyParticipants": 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
            await batch.commit();
      return null;
    } catch (error) {
      functions.logger.error("Error resetting daily stats", error);
      return null;
    }
  });
