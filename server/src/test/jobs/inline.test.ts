import { jest } from '@jest/globals';
import type { TicketTask } from '@/jobs/handlers.js';
import { createInlineJobQueue } from '@/jobs/inline.js';

/** Collects the deferred work so tests can wait for it, like `waitUntil` does on Vercel. */
function deferCollector() {
  const deferred: Promise<unknown>[] = [];
  return {
    defer: (work: Promise<unknown>) => void deferred.push(work),
    settled: () => Promise.all(deferred),
    count: () => deferred.length,
  };
}

const options = { retryDelaysMs: [0, 0] };

describe('createInlineJobQueue', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the job after returning, through defer', async () => {
    const classify = jest.fn<TicketTask>().mockResolvedValue();
    const { defer, settled } = deferCollector();
    const jobs = createInlineJobQueue({ classify }, { ...options, defer });

    await jobs.classifyTicket(7);
    await settled();

    expect(classify).toHaveBeenCalledTimes(1);
    expect(classify).toHaveBeenCalledWith(7, expect.any(AbortSignal));
  });

  it('retries a failed job until it succeeds', async () => {
    const autoResolve = jest
      .fn<TicketTask>()
      .mockRejectedValueOnce(new Error('AI timeout'))
      .mockResolvedValue();
    const { defer, settled } = deferCollector();
    const jobs = createInlineJobQueue({ autoResolve }, { ...options, defer });

    await jobs.autoResolveTicket(3);
    await settled();

    expect(autoResolve).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last retry without rejecting', async () => {
    const classify = jest.fn<TicketTask>().mockRejectedValue(new Error('AI down'));
    const { defer, settled } = deferCollector();
    const jobs = createInlineJobQueue({ classify }, { ...options, defer });

    await jobs.classifyTicket(5);
    await expect(settled()).resolves.toBeDefined();

    expect(classify).toHaveBeenCalledTimes(3);
  });

  it('skips jobs that have no handler', async () => {
    const { defer, count } = deferCollector();
    const jobs = createInlineJobQueue({}, { ...options, defer });

    await jobs.classifyTicket(1);
    await jobs.autoResolveTicket(1);

    expect(count()).toBe(0);
  });
});
