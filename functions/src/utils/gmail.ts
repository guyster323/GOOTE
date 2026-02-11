import { google } from "googleapis";
import * as nodemailer from "nodemailer";
import * as functions from "firebase-functions";

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
          reject("Failed to create access token : " + err);
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
    functions.logger.info("Email sent successfully", { messageId: result.messageId });
    return result;
  } catch (error) {
    functions.logger.error("Error sending email via Gmail API", error);
    throw error;
  }
}
