import { polishReply } from '@/services/reply-polish.js';
import type { Database } from '@/db.js';

describe('polishReply', () => {
  it('responds 503 when no model is configured', async () => {
    await expect(
      polishReply({
        db: {} as Database,
        model: undefined,
        ticketId: 1,
        agentName: 'Alan Agent',
        draft: 'Hi',
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});
