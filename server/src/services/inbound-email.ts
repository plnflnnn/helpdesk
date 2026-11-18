import { createHash } from 'node:crypto';
import { Prisma } from '@generated/prisma/client.js';
import type { Database } from '@/db.js';
import type { JobQueue } from '@/jobs/queue.js';

/** The fields of a SendGrid Inbound Parse POST (default "parsed" mode) that we use. */
export type InboundParseFields = {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  /** All the email's headers, as raw text. */
  headers?: string;
  /** JSON: `{ "to": [...], "from": "..." }`, the SMTP envelope. */
  envelope?: string;
};

export type InboundEmail = {
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyText: string;
  /** The `Message-ID` header, or one derived from the email's content when it has none. */
  messageId: string;
  inReplyTo: string | null;
  /** `References` header: the thread's Message-IDs, oldest first. */
  references: string[];
  /** Every address the email was sent to (headers and envelope). */
  recipients: string[];
};

/** The email in a form we can store, or null when it has no usable sender. */
export function parseInboundEmail(fields: InboundParseFields): InboundEmail | null {
  const sender = parseAddress(fields.from ?? '');
  if (!sender) {
    return null;
  }
  const headers = parseHeaders(fields.headers ?? '');
  const subject = fields.subject?.trim() || '(no subject)';
  const bodyText = (fields.text?.trim() || htmlToText(fields.html ?? '')).trim();
  return {
    fromEmail: sender.email,
    fromName: sender.name,
    subject,
    bodyText,
    messageId:
      messageIds(headers.get('message-id'))[0] ??
      fallbackMessageId([sender.email, headers.get('date') ?? '', subject, bodyText]),
    inReplyTo: messageIds(headers.get('in-reply-to'))[0] ?? null,
    references: messageIds(headers.get('references')),
    recipients: [...(fields.to?.split(',') ?? []), ...envelopeRecipients(fields.envelope)]
      .map((address) => parseAddress(address)?.email)
      .filter((email) => email !== undefined),
  };
}

type ReceiveEmailParams = {
  db: Database;
  jobs: JobQueue;
  email: InboundEmail;
};

export type ReceiveEmailResult =
  | { outcome: 'created'; ticketId: number }
  | { outcome: 'threaded'; ticketId: number }
  | { outcome: 'duplicate' };

/**
 * Saves a student's email: as a reply on the ticket it answers, or as a new ticket. New tickets are
 * queued for AI classification and auto-resolving, which run later in the worker; this never waits
 * for the AI.
 *
 * A reply reopens a pending or resolved ticket; a reply to a closed ticket starts a new one.
 * An email that was already received (same Message-ID, e.g. a webhook retry) is ignored, including
 * when two deliveries of it arrive at the same time.
 */
export async function receiveEmail({
  db,
  jobs,
  email,
}: ReceiveEmailParams): Promise<ReceiveEmailResult> {
  const existing = await db.message.findUnique({
    where: { emailMessageId: email.messageId },
    select: { id: true },
  });
  if (existing) {
    return { outcome: 'duplicate' };
  }
  try {
    return await saveEmail(db, jobs, email);
  } catch (error) {
    // A concurrent delivery of the same email saved its message first.
    if (isDuplicateMessageId(error)) {
      return { outcome: 'duplicate' };
    }
    throw error;
  }
}

async function saveEmail(
  db: Database,
  jobs: JobQueue,
  email: InboundEmail,
): Promise<ReceiveEmailResult> {
  const message = {
    direction: 'inbound',
    bodyText: email.bodyText,
    emailMessageId: email.messageId,
    inReplyTo: email.inReplyTo,
  } as const;

  const thread = await findThread(db, email);
  if (thread && thread.status !== 'closed') {
    await db.ticket.update({
      where: { id: thread.id },
      data: { status: 'open', resolvedAt: null, messages: { create: message } },
    });
    return { outcome: 'threaded', ticketId: thread.id };
  }

  const student = await upsertStudent(db, email);
  if (!student.name && email.fromName) {
    await db.student.update({ where: { id: student.id }, data: { name: email.fromName } });
  }
  const ticket = await db.ticket.create({
    data: { subject: email.subject, studentId: student.id, messages: { create: message } },
    select: { id: true },
  });

  // The ticket is already saved, so a queue failure must not fail the webhook (SendGrid would
  // retry, and the retry would be ignored as a duplicate). Agents can still handle it by hand.
  const queued = await Promise.allSettled([
    jobs.classifyTicket(ticket.id),
    jobs.autoResolveTicket(ticket.id),
  ]);
  for (const result of queued) {
    if (result.status === 'rejected') {
      console.error(`Could not queue a job for ticket ${ticket.id}`, result.reason);
    }
  }
  return { outcome: 'created', ticketId: ticket.id };
}

/**
 * Prisma's upsert reads, then inserts, so two emails from a new student arriving together can both
 * try to insert: the loser retries once and finds the winner's row.
 */
async function upsertStudent(db: Database, email: InboundEmail) {
  const upsert = () =>
    db.student.upsert({
      where: { email: email.fromEmail },
      create: { email: email.fromEmail, name: email.fromName },
      update: {},
    });
  try {
    return await upsert();
  } catch (error) {
    if (isUniqueViolation(error, 'email')) {
      return upsert();
    }
    throw error;
  }
}

function isDuplicateMessageId(error: unknown) {
  return isUniqueViolation(error, 'emailMessageId');
}

/** A unique-constraint error naming `field` (Prisma reports the constraint in `meta`). */
function isUniqueViolation(error: unknown, field: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes(field)
  );
}

/**
 * The ticket this email replies to: found by its `In-Reply-To` / `References` headers, or else by
 * a `support+T<id>@` recipient address. Either way the sender must be that ticket's student, so
 * a CC'd or forwarded recipient's reply starts a ticket of their own.
 */
async function findThread(db: Database, email: InboundEmail) {
  const select = { id: true, status: true, student: { select: { email: true } } } as const;

  const referencedIds = [email.inReplyTo, ...email.references.toReversed()].filter(
    (id) => id !== null,
  );
  if (referencedIds.length > 0) {
    const messages = await db.message.findMany({
      where: { emailMessageId: { in: referencedIds } },
      select: { emailMessageId: true, ticket: { select } },
    });
    // Prefer the most recent message in the thread.
    for (const id of referencedIds) {
      const match = messages.find((message) => message.emailMessageId === id);
      if (match) {
        return match.ticket.student.email === email.fromEmail ? match.ticket : null;
      }
    }
  }

  for (const recipient of email.recipients) {
    const ticketId = Number(/\+t(\d+)@/i.exec(recipient)?.[1]);
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      continue;
    }
    const ticket = await db.ticket.findUnique({ where: { id: ticketId }, select });
    if (ticket?.student.email === email.fromEmail) {
      return ticket;
    }
  }
  return null;
}

/** `"Mia Wong" <Mia@Example.com>` → `{ email: 'mia@example.com', name: 'Mia Wong' }`. */
function parseAddress(value: string): { email: string; name: string | null } | null {
  const angle = /^(.*)<([^<>]+)>\s*$/.exec(value.trim());
  const email = (angle ? angle[2]! : value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    return null;
  }
  const name = angle?.[1]!
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .trim();
  return { email, name: name || null };
}

/** Raw header text → lower-cased header name → first value. Folded (multi-line) headers are joined. */
function parseHeaders(raw: string) {
  const headers = new Map<string, string>();
  for (const line of raw.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) {
      continue;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!headers.has(name)) {
      headers.set(name, line.slice(colon + 1).trim());
    }
  }
  return headers;
}

/**
 * A stable Message-ID for an email that has none, so retries of the same webhook are still
 * recognised as duplicates. The `Date` header keeps a genuinely re-sent email apart.
 */
function fallbackMessageId(parts: string[]) {
  const hash = createHash('sha256').update(parts.join('\0')).digest('hex');
  return `<${hash}@inbound.invalid>`;
}

/** Every `<...>` Message-ID in a header value, in order. */
function messageIds(value: string | undefined) {
  return value?.match(/<[^<>\s]+>/g) ?? [];
}

function envelopeRecipients(envelope: string | undefined): string[] {
  if (!envelope) {
    return [];
  }
  try {
    const { to } = JSON.parse(envelope) as { to?: unknown };
    return Array.isArray(to) ? to.filter((address) => typeof address === 'string') : [];
  } catch {
    return [];
  }
}

/** Plain text from an HTML body, for emails that have no text part. */
function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n');
}
