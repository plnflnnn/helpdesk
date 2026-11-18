import { jest } from '@jest/globals';
import { MockLanguageModelV4 } from 'ai/test';
import type { Mailer } from '@/services/email.js';
import {
  AI_SENDER_NAME,
  autoResolveTicket,
  type AutoResolveDecision,
} from '@/services/ticket-auto-resolve.js';
import { createTestContext } from '@/test/context.js';

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;

const modelReply = (decision: AutoResolveDecision): GenerateResult => ({
  content: [{ type: 'text', text: JSON.stringify(decision) }],
  finishReason: { unified: 'stop', raw: 'stop' },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
  },
  warnings: [],
});

const KNOWLEDGE_BASE = '## Certificates\nA certificate is issued upon course completion.';
const ANSWER = 'Hi Mia,\n\nYour certificate is in your dashboard.\n\nBest regards,\nSupport Team';

const doGenerate = jest.fn<MockLanguageModelV4['doGenerate']>();
const model = new MockLanguageModelV4({ doGenerate });
const send = jest.fn<Mailer['send']>();
const mailer: Mailer = { from: 'support@example.com', send };
const ctx = createTestContext();

beforeEach(async () => {
  doGenerate.mockReset();
  send.mockReset();
  await ctx.reset();
});
afterAll(() => ctx.close());

async function createTicket() {
  return ctx.db.ticket.create({
    data: {
      subject: 'Do I get a certificate?',
      student: { create: { email: 'mia@example.com', name: 'Mia' } },
      messages: {
        create: {
          direction: 'inbound',
          bodyText: 'Will I get a certificate when I finish?',
          emailMessageId: '<first@mail.example.com>',
        },
      },
    },
  });
}

const run = (ticketId: number, signal?: AbortSignal) =>
  autoResolveTicket({ db: ctx.db, model, mailer, knowledgeBase: KNOWLEDGE_BASE, ticketId, signal });

const findTicket = (id: number) =>
  ctx.db.ticket.findUniqueOrThrow({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

describe('autoResolveTicket', () => {
  it('emails the answer and resolves the ticket', async () => {
    const { id } = await createTicket();
    doGenerate.mockResolvedValue(modelReply({ resolvable: true, reply: ANSWER }));

    expect(await run(id)).toBe('resolved');

    const prompt = JSON.stringify(doGenerate.mock.calls[0]![0].prompt);
    expect(prompt).toContain('A certificate is issued upon course completion.');
    expect(prompt).toContain('Will I get a certificate when I finish?');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'mia@example.com',
        subject: 'Re: Do I get a certificate?',
        text: ANSWER,
        fromName: AI_SENDER_NAME,
        replyTo: `support+T${id}@example.com`,
      }),
    );
    const ticket = await findTicket(id);
    expect(ticket.status).toBe('resolved');
    expect(ticket.messages.at(-1)).toMatchObject({
      direction: 'outbound',
      authorId: null,
      sentByAi: true,
      bodyText: ANSWER,
      inReplyTo: '<first@mail.example.com>',
    });
  });

  it('sends nothing when the job was aborted (timed out) while the AI was running', async () => {
    const { id } = await createTicket();
    const controller = new AbortController();
    doGenerate.mockImplementation(async () => {
      controller.abort(new Error('Job expired'));
      return modelReply({ resolvable: true, reply: ANSWER });
    });

    await expect(run(id, controller.signal)).rejects.toThrow('Job expired');

    expect(send).not.toHaveBeenCalled();
    expect((await findTicket(id)).status).toBe('open');
  });

  it('leaves the ticket to agents when the knowledge base does not answer it', async () => {
    const { id } = await createTicket();
    doGenerate.mockResolvedValue(modelReply({ resolvable: false, reply: '' }));

    expect(await run(id)).toBe('skipped');

    expect(send).not.toHaveBeenCalled();
    expect((await findTicket(id)).status).toBe('open');
  });

  it('skips a ticket an agent has already picked up, without asking the AI', async () => {
    const { id } = await createTicket();
    const agent = await ctx.createUser();
    await ctx.db.ticket.update({ where: { id }, data: { assigneeId: agent.id } });

    expect(await run(id)).toBe('skipped');

    expect(doGenerate).not.toHaveBeenCalled();
  });

  it('does not send when an agent replied while the AI was running', async () => {
    const { id } = await createTicket();
    doGenerate.mockImplementation(async () => {
      await ctx.db.message.create({
        data: { ticketId: id, direction: 'outbound', bodyText: 'On it!' },
      });
      return modelReply({ resolvable: true, reply: ANSWER });
    });

    expect(await run(id)).toBe('skipped');

    expect(send).not.toHaveBeenCalled();
    expect((await findTicket(id)).status).toBe('open');
  });

  it('throws and leaves the ticket open when the email cannot be sent, so the job is retried', async () => {
    const { id } = await createTicket();
    doGenerate.mockResolvedValue(modelReply({ resolvable: true, reply: ANSWER }));
    send.mockRejectedValue(new Error('SendGrid is down'));

    await expect(run(id)).rejects.toThrow('SendGrid is down');

    expect((await findTicket(id)).status).toBe('open');
  });
});
