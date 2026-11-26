import sgMail from '@sendgrid/mail';

export type Email = {
  to: string;
  subject: string;
  text: string;
  /** Shown next to the support address, e.g. the replying agent's name. */
  fromName?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

/** Sends from SENDGRID_FROM_EMAIL. Without SendGrid configured, logs the email instead (not in production). */
export async function sendEmail({ to, subject, text, fromName, replyTo, headers }: Email) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are required in production');
    }
    console.log('[email not sent: SendGrid is not configured]', { to, subject, text });
    return;
  }

  sgMail.setApiKey(apiKey);
  sgMail.setTimeout(15_000);
  await sgMail.send({ to, from: { email: from, name: fromName }, replyTo, subject, text, headers });
}
