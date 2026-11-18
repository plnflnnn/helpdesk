import { MailService } from '@sendgrid/mail';

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  /** Display name shown next to the support address, e.g. the replying agent's name. */
  fromName?: string;
  replyTo?: string;
  /** Extra headers, e.g. `Message-ID`, `In-Reply-To`, `References` for threading. */
  headers?: Record<string, string>;
};

/** Sends email from the support address. Throws when the email could not be sent. */
export type Mailer = {
  /** The address emails are sent from, e.g. `support@example.com`. */
  readonly from: string;
  send(email: OutgoingEmail): Promise<void>;
};

/** Sends through the SendGrid Mail Send API. */
export function createSendGridMailer({ apiKey, from }: { apiKey: string; from: string }): Mailer {
  const client = new MailService();
  client.setApiKey(apiKey);
  client.setTimeout(15_000);

  return {
    from,
    async send({ to, subject, text, fromName, replyTo, headers }) {
      await client.send({
        to,
        from: { email: from, name: fromName },
        replyTo,
        subject,
        text,
        headers,
      });
    },
  };
}

/** Logs emails instead of sending them: used in development when SendGrid isn't configured. */
export function createConsoleMailer(from = 'support@localhost'): Mailer {
  return {
    from,
    async send(email) {
      console.log('[email not sent: SendGrid is not configured]', email);
    },
  };
}

/** `support@example.com` + ticket 42 → `support+T42@example.com`, so replies can be matched to the ticket. */
export function ticketReplyAddress(from: string, ticketId: number) {
  const [local, domain] = splitAddress(from);
  return `${local}+T${ticketId}@${domain}`;
}

/** A new globally unique `Message-ID` on the support domain. */
export function newMessageId(from: string) {
  const [, domain] = splitAddress(from);
  return `<${crypto.randomUUID()}@${domain}>`;
}

function splitAddress(address: string): [string, string] {
  const at = address.lastIndexOf('@');
  return [address.slice(0, at), address.slice(at + 1)];
}
