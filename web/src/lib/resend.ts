import "server-only";

import { mustGetEnv } from "@/lib/env";

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function sendResendEmail({ to, subject, html }: SendEmailArgs) {
  const apiKey = mustGetEnv("RESEND_API_KEY");
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${text}`);
  }

  return res.json().catch(() => ({}));
}

