import { TRPCError } from "@trpc/server";

export type SendInviteEmailInput = {
  toEmail: string;
  organizationName: string;
  token: string;
};

type ResendEmailResponse = {
  id?: string;
  message?: string;
};

function getInviteAcceptUrl(token: string): string {
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  return `${webOrigin}/invite/accept?token=${encodeURIComponent(token)}`;
}

export async function sendInviteEmail(input: SendInviteEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "RESEND_API_KEY is not configured",
    });
  }

  const inviteUrl = getInviteAcceptUrl(input.token);
  const from = "Pactul <onboarding@pactul.com>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      reply_to: "no-reply@pactul.com",
      to: [input.toEmail],
      subject: `You're invited to create ${input.organizationName} on Pactolus`,
      html: `
        <p>You were invited to create and activate <strong>${escapeHtml(input.organizationName)}</strong> on Pactolus.</p>
        <p>This link expires in 7 days:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p><em>Please do not reply to this email.</em></p>
      `,
      text: [
        `You were invited to create and activate "${input.organizationName}" on Pactolus.`,
        "",
        "This link expires in 7 days:",
        inviteUrl,
        "",
        "Please do not reply to this email.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to send invite email: ${response.status} ${body}`,
    });
  }

  const result = (await response.json()) as ResendEmailResponse;
  if (!result.id) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Email provider did not return a message id",
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
