import { Router } from 'express';
import multer from 'multer';
import { Prisma } from '@generated/prisma/client.js';
import prisma from '@/db.js';
import { parseInboundEmail, type InboundEmail } from '@/lib/parse-email.js';
import { sendAutoResolveJob, sendClassifyJob } from '@/lib/queue.js';
import { requireWebhookSecret } from '@/middleware/require-webhook-secret.js';

// Attachments aren't stored, so their contents are read and thrown away. SendGrid caps an email at 30 MB.
const upload = multer({
  storage: {
    _handleFile(_req, file, callback) {
      file.stream.on('error', callback);
      file.stream.on('end', () => callback(null, {}));
      file.stream.resume();
    },
    _removeFile(_req, _file, callback) {
      callback(null);
    },
  },
  limits: { fieldSize: 30 * 1024 * 1024 },
});

const router = Router();

/**
 * SendGrid Inbound Parse: one POST per email, at /webhooks/inbound?secret=<SENDGRID_INBOUND_SECRET>.
 * Saves the email as a reply on the ticket it answers, or as a new ticket (queued for the AI).
 * Always answers 200 for a handled email, since an error only makes SendGrid retry it for days.
 */
router.post('/inbound', requireWebhookSecret, upload.any(), async (req, res) => {
  const email = parseInboundEmail(req.body ?? {});
  if (!email) {
    console.warn('Ignored an inbound email without a valid sender');
    res.json({ outcome: 'ignored' });
    return;
  }

  // Already received (a webhook retry, or two deliveries arriving together).
  const duplicate = await prisma.message.findUnique({
    where: { emailMessageId: email.messageId },
    select: { id: true },
  });
  if (duplicate) {
    res.json({ outcome: 'duplicate' });
    return;
  }

  try {
    res.json(await saveEmail(email));
  } catch (error) {
    if (isUniqueViolation(error, 'emailMessageId')) {
      res.json({ outcome: 'duplicate' });
      return;
    }
    throw error;
  }
});

async function saveEmail(email: InboundEmail) {
  const message = {
    direction: 'inbound',
    bodyText: email.bodyText,
    emailMessageId: email.messageId,
    inReplyTo: email.inReplyTo,
  } as const;

  // A reply reopens its ticket; a reply to a closed ticket starts a new one.
  const thread = await findThread(email);
  if (thread && thread.status !== 'closed') {
    await prisma.ticket.update({
      where: { id: thread.id },
      data: { status: 'open', resolvedAt: null, messages: { create: message } },
    });
    return { outcome: 'threaded', ticketId: thread.id };
  }

  const student = await upsertStudent(email);
  if (!student.name && email.fromName) {
    await prisma.student.update({ where: { id: student.id }, data: { name: email.fromName } });
  }
  const ticket = await prisma.ticket.create({
    data: { subject: email.subject, studentId: student.id, messages: { create: message } },
    select: { id: true },
  });

  // The ticket is saved, so a queue failure must not fail the webhook: agents can still handle it.
  const queued = await Promise.allSettled([
    sendClassifyJob(ticket.id),
    sendAutoResolveJob(ticket.id),
  ]);
  for (const result of queued) {
    if (result.status === 'rejected') {
      console.error(`Could not queue a job for ticket ${ticket.id}`, result.reason);
    }
  }
  return { outcome: 'created', ticketId: ticket.id };
}

/**
 * The ticket this email replies to: by its `In-Reply-To` / `References` headers, or else by a
 * `support+T<id>@` recipient. The sender must be that ticket's student, so a CC'd or forwarded
 * recipient's reply starts a ticket of their own.
 */
async function findThread(email: InboundEmail) {
  const select = { id: true, status: true, student: { select: { email: true } } } as const;

  const referencedIds = [email.inReplyTo, ...email.references.toReversed()].filter(
    (id) => id !== null,
  );
  if (referencedIds.length > 0) {
    const messages = await prisma.message.findMany({
      where: { emailMessageId: { in: referencedIds } },
      select: { emailMessageId: true, ticket: { select } },
    });
    // The most recent message in the thread wins.
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
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select });
    if (ticket?.student.email === email.fromEmail) {
      return ticket;
    }
  }
  return null;
}

/** Two emails from a new student arriving together can both insert: the loser retries once. */
async function upsertStudent(email: InboundEmail) {
  const upsert = () =>
    prisma.student.upsert({
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

function isUniqueViolation(error: unknown, field: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes(field)
  );
}

export default router;
