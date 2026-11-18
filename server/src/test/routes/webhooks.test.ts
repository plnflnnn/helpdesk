import { jest } from '@jest/globals';
import type { JobQueue } from '@/jobs/queue.js';
import { createTestContext, INBOUND_EMAIL_SECRET } from '@/test/context.js';

const classifyTicket = jest.fn<JobQueue['classifyTicket']>();
const autoResolveTicket = jest.fn<JobQueue['autoResolveTicket']>();
const ctx = createTestContext({ jobs: { classifyTicket, autoResolveTicket } });

beforeEach(async () => {
  classifyTicket.mockReset();
  autoResolveTicket.mockReset();
  await ctx.reset();
});
afterAll(() => ctx.close());

type EmailOptions = {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
};

/** Posts an email to the webhook the way SendGrid Inbound Parse does (multipart form data). */
function postEmail(
  {
    from = 'Mia Wong <Mia@Example.com>',
    to = 'support@example.com',
    subject = 'Cannot log in',
    text = 'The password reset email never arrived.',
    messageId = '<first@mail.example.com>',
    inReplyTo,
    references,
  }: EmailOptions = {},
  secret = INBOUND_EMAIL_SECRET,
) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    inReplyTo && `In-Reply-To: ${inReplyTo}`,
    // Long headers are folded onto several lines.
    references && `References: ${references.split(' ').join('\r\n ')}`,
  ]
    .filter(Boolean)
    .join('\r\n');

  return ctx
    .client()
    .post(`/webhooks/inbound?secret=${encodeURIComponent(secret)}`)
    .field('from', from)
    .field('to', to)
    .field('subject', subject)
    .field('text', text)
    .field('headers', headers)
    .field('envelope', JSON.stringify({ to: [to], from: 'bounce@example.com' }))
    .attach('attachment1', Buffer.from('fake pdf'), 'receipt.pdf');
}

async function onlyTicket() {
  return ctx.db.ticket.findFirstOrThrow({
    include: { student: true, messages: { orderBy: { createdAt: 'asc' } } },
  });
}

describe('POST /webhooks/inbound', () => {
  it('rejects a wrong secret with 401 and saves nothing', async () => {
    const response = await postEmail({}, 'wrong-secret');

    expect(response.status).toBe(401);
    expect(await ctx.db.ticket.count()).toBe(0);
  });

  it('creates a ticket and student from a new email and queues its AI jobs', async () => {
    const response = await postEmail();

    expect(response.status).toBe(200);
    const ticket = await onlyTicket();
    expect(response.body).toEqual({ outcome: 'created', ticketId: ticket.id });
    expect(ticket).toMatchObject({
      subject: 'Cannot log in',
      status: 'open',
      student: { email: 'mia@example.com', name: 'Mia Wong' },
    });
    expect(ticket.messages).toEqual([
      expect.objectContaining({
        direction: 'inbound',
        bodyText: 'The password reset email never arrived.',
        emailMessageId: '<first@mail.example.com>',
      }),
    ]);
    expect(classifyTicket).toHaveBeenCalledWith(ticket.id);
    expect(autoResolveTicket).toHaveBeenCalledWith(ticket.id);
  });

  it('still saves the ticket when the job cannot be queued', async () => {
    classifyTicket.mockRejectedValue(new Error('queue down'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await postEmail();

    consoleError.mockRestore();
    expect(response.status).toBe(200);
    expect(await ctx.db.ticket.count()).toBe(1);
  });

  it('ignores an email it already received (a SendGrid retry)', async () => {
    await postEmail();

    const response = await postEmail();

    expect(response.body).toEqual({ outcome: 'duplicate' });
    expect(await ctx.db.message.count()).toBe(1);
    expect(classifyTicket).toHaveBeenCalledTimes(1);
  });

  it('threads a reply onto its ticket by References and reopens it, without new AI jobs', async () => {
    await postEmail();
    const { id } = await onlyTicket();
    await ctx.db.ticket.update({
      where: { id },
      data: {
        status: 'resolved',
        messages: {
          create: {
            direction: 'outbound',
            bodyText: 'Sent again.',
            emailMessageId: '<reply@example.com>',
          },
        },
      },
    });

    const response = await postEmail({
      subject: 'Re: Cannot log in',
      text: 'Got it, thanks!',
      messageId: '<second@mail.example.com>',
      references: '<first@mail.example.com> <reply@example.com>',
    });

    expect(response.body).toEqual({ outcome: 'threaded', ticketId: id });
    const ticket = await onlyTicket();
    expect(ticket.status).toBe('open');
    expect(ticket.messages.map((message) => message.bodyText)).toEqual([
      'The password reset email never arrived.',
      'Sent again.',
      'Got it, thanks!',
    ]);
    expect(classifyTicket).toHaveBeenCalledTimes(1);
    expect(autoResolveTicket).toHaveBeenCalledTimes(1);
  });

  it('threads a reply by its support+T<id> address when the headers are missing', async () => {
    await postEmail();
    const { id } = await onlyTicket();

    const response = await postEmail({
      to: `Support <support+T${id}@example.com>`,
      messageId: '<second@mail.example.com>',
    });

    expect(response.body).toEqual({ outcome: 'threaded', ticketId: id });
  });

  it('does not thread by support+T<id> address when the sender is not the ticket’s student', async () => {
    await postEmail();
    const { id } = await onlyTicket();

    const response = await postEmail({
      from: 'someone@else.com',
      to: `support+T${id}@example.com`,
      messageId: '<other@mail.example.com>',
    });

    expect(response.body).toEqual({ outcome: 'created', ticketId: id + 1 });
  });

  it('starts a new ticket when the student replies to a closed one', async () => {
    await postEmail();
    const { id } = await onlyTicket();
    await ctx.db.ticket.update({ where: { id }, data: { status: 'closed' } });

    const response = await postEmail({
      messageId: '<second@mail.example.com>',
      inReplyTo: '<first@mail.example.com>',
    });

    expect(response.body).toEqual({ outcome: 'created', ticketId: id + 1 });
    expect(await ctx.db.student.count()).toBe(1);
  });

  it('ignores an email without a valid sender', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await postEmail({ from: 'not an address' });

    consoleWarn.mockRestore();
    expect(response.status).toBe(200);
    expect(await ctx.db.ticket.count()).toBe(0);
  });
});
