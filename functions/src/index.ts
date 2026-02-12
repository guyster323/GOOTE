import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendGmail } from "./utils/gmail";

admin.initializeApp();

const db = admin.firestore();

// Max timeout for cold starts and heavy operations
const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 300,
  memory: "512MB"
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
    role: "user",
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
  const path = req.path;

  if (path === "/approve-tester") {
    // Redirect legacy approval links to the dashboard
    const { appId } = req.query;
    if (appId) {
      res.redirect(`https://goote-f48d8.web.app/my-apps/${appId}`);
    } else {
      res.redirect("https://goote-f48d8.web.app/dashboard");
    }
  } else if (path === "/track-daily") {
    const { pid } = req.query;
    if (!pid) {
      res.status(400).send("Missing pid");
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const partRef = db.collection("participations").doc(pid as string);
      const partSnap = await partRef.get();

      if (!partSnap.exists) {
        res.status(404).send("Participation not found");
        return;
      }

      const data = partSnap.data();
      const appId = data?.appId;
      const type = req.query.type as string; // 'android' or 'web'

      if (data?.lastCheckIn !== today) {
        await partRef.update({
          lastCheckIn: today,
          consecutiveDays: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Also increment app's dailyParticipants
        if (appId) {
          await db.collection("apps").doc(appId).update({
            "stats.dailyParticipants": admin.firestore.FieldValue.increment(1)
          });
        }
      }

      // Redirect to the actual testing link
      const appSnap = await db.collection("apps").doc(appId).get();
      const appData = appSnap.data();
      const redirectUrl = type === "web"
        ? appData?.webParticipationLink
        : appData?.androidParticipationLink;

      if (redirectUrl) {
        res.redirect(redirectUrl);
      } else if (appId) {
        res.redirect(`https://goote-f48d8.web.app/apps/${appId}`);
      } else {
        res.redirect("https://goote-f48d8.web.app/dashboard");
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
 * Increments the participant count for the app and the testsJoined count for the user.
 */
export const onParticipationCreated = functions.firestore
  .document("participations/{participationId}")
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const { appId, testerId } = data;

    try {
      const batch = db.batch();

      // 1. Increment app's participants stats
      const appRef = db.collection("apps").doc(appId);
      batch.update(appRef, {
        "stats.participants": admin.firestore.FieldValue.increment(1),
        "stats.dailyParticipants": admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2. Increment tester's testsJoined stats
      const userRef = db.collection("users").doc(testerId);
      batch.update(userRef, {
        "stats.testsJoined": admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();
      functions.logger.info(`Participation initialized for App: ${appId}, Tester: ${testerId}`);
    } catch (error) {
      functions.logger.error(`Error initializing participation for ID: ${context.params.participationId}`, error);
    }
  });

/**
 * Triggered by HTTPS request to notify developer about a participation request.
 * Creates a pending participation request and notifies the developer.
 */
export const requestParticipation = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const { appId } = data;
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
    const developerId = appData?.developerId;
    const testerData = testerSnap.data();

    // Check if already participating or pending
    const participationQuery = await db.collection("participations")
      .where("appId", "==", appId)
      .where("testerId", "==", testerId)
      .get();

    if (!participationQuery.empty) {
      const status = participationQuery.docs[0].data().status;
      if (status === "active" || status === "completed") {
        throw new functions.https.HttpsError("already-exists", "이미 참여 중인 앱입니다.");
      } else if (status === "pending") {
        throw new functions.https.HttpsError("already-exists", "이미 참여 요청을 보냈습니다.");
      }
    }

    // Create participation directly as active
    await db.collection("participations").add({
      appId,
      appName: appData?.name,
      testerId,
      testerEmail: testerData?.email,
      testerNickname: testerData?.nickname,
      status: "active",
      consecutiveDays: 0,
      targetDays: appData?.testDuration || 14,
      lastCheckIn: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
              <a href="https://goote-f48d8.web.app/my-apps/${appId}" style="display: block; background-color: #0f172a; color: #fff; padding: 18px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; margin-bottom: 12px;">
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
 * Callable function to delete an app and its related data.
 */
export const deleteApp = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const { appId } = data;
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
export const approveTester = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const { participationId } = data;
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

      const consoleLink = `https://play.google.com/console/u/0/developers/${appData?.developerConsoleId || ""}/app/${appData?.packageName || ""}/testing/internal`;
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
                <li style="margin-bottom: 8px;">아래 버튼을 눌러 Google Play Console 내부 테스트 페이지로 이동하세요.</li>
                <li style="margin-bottom: 8px;">초대를 수락하고 앱을 다운로드해주세요.</li>
                <li>매일 앱을 실행하고 GOOTE에서 출석 체크를 해주세요.</li>
              </ol>
            </div>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${consoleLink}" style="background-color: #0f172a; color: #fff; padding: 18px 30px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; display: inline-block;">
                앱 다운로드 하러가기
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
      const { testerId, appId } = newData;

      try {
        const batch = db.batch();

        // 1. Update participation status
        const participationRef = db.collection("participations").doc(context.params.participationId);
        batch.update(participationRef, {
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2. Increment tester's testsCompleted stats
        const userRef = db.collection("users").doc(testerId);
        batch.update(userRef, {
          "stats.testsCompleted": admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Increment app's completedTesters stats
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
      } else if (toType === "user") {
        await db.collection("users").doc(toId).update({
          "stats.totalLikes": admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
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

      const promises = activeParticipationsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const participationId = doc.id;
        const { testerEmail, testerNickname, appId, appName } = data;

        const appSnap = await db.collection("apps").doc(appId).get();
        const appData = appSnap.data();

        // Daily tracking links
        const trackLinkAndroid = `https://goote-f48d8.web.app/api/track-daily?pid=${participationId}&type=android`;
        const trackLinkWeb = `https://goote-f48d8.web.app/api/track-daily?pid=${participationId}&type=web`;

        const subject = `[GOOTE] 오늘 ${appName} 앱을 실행하고 참여를 인증해주세요!`;
        const html = `
          <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #0f172a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
              <h1 style="color: #fff; margin: 0;">GOOTE</h1>
            </div>
            <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px;">
              <h2 style="font-size: 20px; font-weight: 800; margin-top: 0;">안녕하세요, ${testerNickname}님!</h2>
              <p>오늘의 테스트 참여 시간입니다. 아래 버튼을 눌러 앱을 실행해주세요.</p>

              <div style="background-color: #f8fafc; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid #f1f5f9;">
                <p style="margin-top: 0; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">대상 앱 정보</p>
                <div style="display: flex; align-items: center; gap: 15px;">
                  ${appData?.iconUrl ? `<img src="${appData.iconUrl}" style="width: 50px; height: 50px; border-radius: 12px;" />` : ""}
                  <div>
                    <p style="margin: 0; font-weight: 800; font-size: 18px;">${appName}</p>
                    <p style="margin: 2px 0 0; color: #64748b; font-size: 14px;">${appData?.category || "App"}</p>
                  </div>
                </div>
              </div>

              <div style="margin: 30px 0; display: flex; flex-direction: column; gap: 12px; align-items: center;">
                <a href="${trackLinkAndroid}" style="display: block; width: 200px; background-color: #0f172a; color: #fff; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; text-align: center;">
                  Android로 실행하기
                </a>
                <a href="${trackLinkWeb}" style="display: block; width: 200px; background-color: #fff; color: #0f172a; border: 2px solid #0f172a; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; text-align: center;">
                  Web으로 실행하기
                </a>
              </div>

              <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                * 버튼을 클릭하면 자동으로 오늘 참여 현황이 업데이트되며 플레이스토어로 이동합니다.<br/>
                * 앱을 실행한 후 1분 이상 사용해주시는 것이 좋습니다.
              </p>
            </div>
          </div>
        `;

        return sendGmail({ to: testerEmail, subject, html, credentials });
      });

      await Promise.all(promises);
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
      const today = new Date().toISOString().split("T")[0];
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

      const promises = activeParticipationsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        // Check if already checked in today
        if (data.lastCheckIn === today) return;

        const participationId = doc.id;
        const { testerEmail, testerNickname, appId, appName } = data;
        const appSnap = await db.collection("apps").doc(appId).get();
        const appData = appSnap.data();

        // Daily tracking links
        const trackLinkAndroid = `https://goote-f48d8.web.app/api/track-daily?pid=${participationId}&type=android`;
        const trackLinkWeb = `https://goote-f48d8.web.app/api/track-daily?pid=${participationId}&type=web`;

        const subject = `[GOOTE] 아직 ${appName} 참여 인증을 하지 않으셨네요! (마감 임박)`;
        const html = `
          <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #be123c; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
              <h1 style="color: #fff; margin: 0;">GOOTE REMINDER</h1>
            </div>
            <div style="padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px;">
              <h2 style="font-size: 20px; font-weight: 800; margin-top: 0;">오늘의 참여가 아직 확인되지 않았습니다.</h2>
              <p>${testerNickname}님, 테스트 참여를 잊으셨나요? 연속 참여 기록을 유지하기 위해 오늘 안에 앱을 실행해주세요!</p>

              <div style="background-color: #fff1f2; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid #ffe4e6;">
                <p style="margin-top: 0; font-weight: 700; color: #e11d48; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">대상 앱 정보</p>
                <div style="display: flex; align-items: center; gap: 15px;">
                  ${appData?.iconUrl ? `<img src="${appData.iconUrl}" style="width: 50px; height: 50px; border-radius: 12px;" />` : ""}
                  <div>
                    <p style="margin: 0; font-weight: 800; font-size: 18px;">${appName}</p>
                    <p style="margin: 2px 0 0; color: #e11d48; font-size: 14px;">${appData?.category || "App"}</p>
                  </div>
                </div>
              </div>

              <div style="margin: 30px 0; display: flex; flex-direction: column; gap: 12px; align-items: center;">
                <a href="${trackLinkAndroid}" style="display: block; width: 200px; background-color: #be123c; color: #fff; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; text-align: center;">
                  Android로 지금 인증
                </a>
                <a href="${trackLinkWeb}" style="display: block; width: 200px; background-color: #fff; color: #be123c; border: 2px solid #be123c; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; text-align: center;">
                  Web으로 지금 인증
                </a>
              </div>
            </div>
          </div>
        `;

        return sendGmail({ to: testerEmail, subject, html, credentials });
      });

      await Promise.all(promises);
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
