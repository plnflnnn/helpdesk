import { doGenerate, mockAi, modelReply } from '@/test/mock-ai.js';

mockAi();
const { classifyTicket } = await import('@/lib/classify-ticket.js');
const { createTestContext } = await import('@/test/context.js');

const ctx = createTestContext();

beforeEach(async () => {
  doGenerate.mockReset();
  await ctx.reset();
});
afterAll(() => ctx.close());

async function createTicket() {
  return ctx.db.ticket.create({
    data: {
      subject: 'Video will not play',
      student: { create: { email: 'mia@example.com' } },
      messages: { create: { direction: 'inbound', bodyText: 'Lesson 3 shows a black screen.' } },
    },
  });
}

const classify = (ticketId: number) => classifyTicket(ticketId);

describe('classifyTicket', () => {
  it('sets the category and priority', async () => {
    const { id } = await createTicket();
    doGenerate.mockResolvedValue(
      modelReply(JSON.stringify({ category: 'technical_question', priority: 'high' })),
    );

    await classify(id);

    expect(await ctx.db.ticket.findUniqueOrThrow({ where: { id } })).toMatchObject({
      category: 'technical_question',
      priority: 'high',
    });
    const prompt = JSON.stringify(doGenerate.mock.calls[0]![0].prompt);
    expect(prompt).toContain('Lesson 3 shows a black screen.');
  });

  it('makes refund requests high priority', async () => {
    const { id } = await createTicket();
    doGenerate.mockResolvedValue(
      modelReply(JSON.stringify({ category: 'refund_request', priority: 'low' })),
    );

    await classify(id);

    expect(await ctx.db.ticket.findUniqueOrThrow({ where: { id } })).toMatchObject({
      priority: 'high',
    });
  });

  it('keeps an agent’s change made while the AI was running', async () => {
    const { id } = await createTicket();
    doGenerate.mockImplementation(async () => {
      await ctx.db.ticket.update({ where: { id }, data: { category: 'general_question' } });
      return modelReply(JSON.stringify({ category: 'technical_question', priority: 'high' }));
    });

    await classify(id);

    expect(await ctx.db.ticket.findUniqueOrThrow({ where: { id } })).toMatchObject({
      category: 'general_question',
      priority: 'normal',
    });
  });

  it('does nothing for a ticket that does not exist', async () => {
    await classify(999);

    expect(doGenerate).not.toHaveBeenCalled();
  });

  it('throws when the AI fails, so the job is retried', async () => {
    const { id } = await createTicket();
    doGenerate.mockRejectedValue(new Error('rate limited'));

    await expect(classify(id)).rejects.toThrow();
    expect(await ctx.db.ticket.findUniqueOrThrow({ where: { id } })).toMatchObject({
      category: 'other',
      priority: 'normal',
    });
  });
});
