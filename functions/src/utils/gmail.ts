import { google } from "googleapis";
import * as nodemailer from "nodemailer";
import * as functions from "firebase-functions/v1";

const MAIL_RETRY_DELAYS_MS = [1500, 4000, 8000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableMailError = (error: any) => {
  const responseCode = Number(error?.responseCode || 0);
  const code = typeof error?.code === "string" ? error.code : "";
  const response = typeof error?.response === "string" ? error.response : "";

  if (responseCode === 421) return true;
  if (responseCode >= 400 && responseCode < 500) return true;
  if (["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNRESET", "EAI_AGAIN"].includes(code)) return true;
  if (response.includes("Temporary System Problem")) return true;

  return false;
};

/**
 * Sends an email using Gmail API with OAuth2.
 *
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - Email body in HTML format
 * @param credentials - Developer's OAuth2 credentials (clientId, clientSecret, refreshToken)
 */
export async function sendGmail({
  to,
  subject,
  html,
  replyTo,
  credentials
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  credentials: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    userEmail: string;
  }
}) {
  const OAuth2 = google.auth.OAuth2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAIL_RETRY_DELAYS_MS.length + 1; attempt += 1) {
    const oauth2Client = new OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken,
    });

    try {
      const accessToken = await new Promise<string>((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
          if (err || !token) {
            reject(new Error("Failed to create access token"));
          } else {
            resolve(token);
          }
        });
      });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: credentials.userEmail,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          refreshToken: credentials.refreshToken,
          accessToken: accessToken,
        },
      } as any);

      const mailOptions: any = {
        from: `GOOTE <${credentials.userEmail}>`,
        to,
        subject,
        html,
      };

      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      const result = await transporter.sendMail(mailOptions);
      functions.logger.info("Email sent successfully", { messageId: result.messageId, attempt });
      return result;
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt <= MAIL_RETRY_DELAYS_MS.length && isRetryableMailError(error);

      if (!shouldRetry) {
        functions.logger.error("Error sending email via Gmail API", error);
        throw error;
      }

      functions.logger.warn("Retrying email send after temporary Gmail failure", {
        attempt,
        nextDelayMs: MAIL_RETRY_DELAYS_MS[attempt - 1],
        responseCode: (error as any)?.responseCode,
        code: (error as any)?.code,
      });

      await sleep(MAIL_RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  functions.logger.error("Error sending email via Gmail API", lastError);
  throw lastError;
}
