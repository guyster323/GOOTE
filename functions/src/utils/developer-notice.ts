import { oneLineText, renderCommentEmail, renderParticipationEmail } from "./html-mail";
import { contactForRecipient } from "./member-privacy";

export type RecipientRecord = {
  role?: unknown;
  email?: unknown;
};

export type RecipientAuthRecord = {
  email?: string | null;
  emailVerified?: boolean;
};

export type NoticeDeps = {
  getRecipient(developerId: string): Promise<RecipientRecord | null>;
  getAuthUser(developerId: string): Promise<RecipientAuthRecord | null>;
  sendGmail(message: { to: string; subject: string; html: string; replyTo?: string }): Promise<void>;
  configuredEmail?: string | null;
};

const recipientAddress = (recipient: RecipientRecord | null): string =>
  typeof recipient?.email === "string" ? recipient.email.trim() : "";

const verifiedAuth = async (
  deps: NoticeDeps,
  developerId: string,
  role: unknown,
): Promise<RecipientAuthRecord | null> => {
  if (role !== "admin") return null;
  try {
    return await deps.getAuthUser(developerId);
  } catch {
    return null;
  }
};

export const deliverParticipationNotice = async (
  deps: NoticeDeps,
  input: {
    developerId: string;
    testerNickname?: unknown;
    testerEmail?: unknown;
    appName?: unknown;
    manageUrl?: unknown;
  },
): Promise<void> => {
  const recipient = await deps.getRecipient(input.developerId);
  const to = recipientAddress(recipient);
  if (!to) return;
  const recipientAuth = await verifiedAuth(deps, input.developerId, recipient?.role);
  const contact = contactForRecipient({
    contactEmail: input.testerEmail,
    recipientRole: recipient?.role,
    recipientAuth,
    configuredEmail: deps.configuredEmail,
  });
  await deps.sendGmail({
    to,
    subject: `[GOOTE] ${oneLineText(input.appName, "앱")} 테스트에 새로운 참여자가 등록되었습니다.`,
    html: renderParticipationEmail({
      testerNickname: input.testerNickname,
      testerEmail: contact.emailForBody ?? "",
      appName: input.appName,
      manageUrl: input.manageUrl,
    }),
    replyTo: contact.replyTo,
  });
};

export const deliverCommentNotice = async (
  deps: NoticeDeps,
  input: {
    developerId: string;
    commenterName?: unknown;
    commenterEmail?: unknown;
    appName?: unknown;
    content?: unknown;
    commentLink?: unknown;
  },
): Promise<void> => {
  const recipient = await deps.getRecipient(input.developerId);
  const to = recipientAddress(recipient);
  if (!to) return;
  const recipientAuth = await verifiedAuth(deps, input.developerId, recipient?.role);
  const contact = contactForRecipient({
    contactEmail: input.commenterEmail,
    recipientRole: recipient?.role,
    recipientAuth,
    configuredEmail: deps.configuredEmail,
  });
  await deps.sendGmail({
    to,
    subject: `[GOOTE] ${oneLineText(input.appName, "앱")}에 새로운 피드백이 등록되었습니다.`,
    html: renderCommentEmail({
      commenterName: input.commenterName,
      appName: input.appName,
      content: input.content,
      commentLink: input.commentLink,
    }),
    replyTo: contact.replyTo,
  });
};
