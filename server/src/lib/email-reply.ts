import prisma from '@/db.js';
import { sendEmail } from '@/lib/send-email.js';

/** The threading headers of an emailed reply, saved on its message. */
export type SentReply = { emailMessageId: string; inReplyTo: string | null };

/**
 * Emails a reply to the ticket's student, threaded onto the conversation (`In-Reply-To`,
 * `References`), with a `support+T<id>@` Reply-To so the answer finds its ticket. Saves nothing.
 * Returns null when the ticket doesn't exist; throws when sending fails.
 */
export async function emailReply(
  ticketId: number,
  fromName: string,
  bodyText: string,
): Promise<SentReply | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      subject: true,
      student: { select: { email: true } },
      messages: {
        where: { emailMessageId: { not: null } },
        select: { emailMessageId: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!ticket) {
    return null;
  }

  const [local, domain] = splitAddress(process.env.SENDGRID_FROM_EMAIL || 'support@localhost');
  const emailMessageId = `<${crypto.randomUUID()}@${domain}>`;
  const references = ticket.messages.map((message) => message.emailMessageId!);
  const inReplyTo = references.at(-1) ?? null;

  await sendEmail({
    to: ticket.student.email,
    subject: /^re:/i.test(ticket.subject) ? ticket.subject : `Re: ${ticket.subject}`,
    text: bodyText,
    fromName,
    replyTo: `${local}+T${ticketId}@${domain}`,
    headers: {
      'Message-ID': emailMessageId,
      ...(inReplyTo && { 'In-Reply-To': inReplyTo, References: references.join(' ') }),
    },
  });
  return { emailMessageId, inReplyTo };
}

function splitAddress(address: string): [string, string] {
  const at = address.lastIndexOf('@');
  return [address.slice(0, at), address.slice(at + 1)];
}
