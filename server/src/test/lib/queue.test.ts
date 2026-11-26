import { jest } from '@jest/globals';

const classifyTicket = jest.fn<(ticketId: number, signal: AbortSignal) => Promise<void>>();
const waitUntil = jest.fn<(work: Promise<unknown>) => void>();
jest.unstable_mockModule('@/lib/classify-ticket.js', () => ({ classifyTicket }));
jest.unstable_mockModule('@/lib/auto-resolve-ticket.js', () => ({ autoResolveTicket: jest.fn() }));
jest.unstable_mockModule('@vercel/functions', () => ({ waitUntil }));
const { runNow, sendClassifyJob } = await import('@/lib/queue.js');

beforeEach(() => {
  classifyTicket.mockReset();
  waitUntil.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.VERCEL;
  jest.restoreAllMocks();
});

describe('sendClassifyJob on Vercel', () => {
  it('runs the job right after the response, through waitUntil', async () => {
    process.env.VERCEL = '1';
    classifyTicket.mockResolvedValue();

    await sendClassifyJob(7);
    await waitUntil.mock.calls[0]![0];

    expect(classifyTicket).toHaveBeenCalledWith(7, expect.any(AbortSignal));
  });
});

describe('runNow', () => {
  it('retries a failed job until it succeeds', async () => {
    classifyTicket.mockRejectedValueOnce(new Error('AI timeout')).mockResolvedValue();

    await runNow('classify-ticket', 3, 0);

    expect(classifyTicket).toHaveBeenCalledTimes(2);
  });

  it('gives up after three attempts without throwing', async () => {
    classifyTicket.mockRejectedValue(new Error('AI down'));

    await expect(runNow('classify-ticket', 5, 0)).resolves.toBeUndefined();

    expect(classifyTicket).toHaveBeenCalledTimes(3);
  });
});
