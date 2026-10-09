type AuthEmail = { to: string; subject: string; text: string; html: string };

export async function sendAuthEmail({ to, subject, text, html }: AuthEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[Studio auth email] ${subject} for ${to}\n${text}`);
      return;
    }
    throw new Error("Password reset email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}.`);
  }
}
