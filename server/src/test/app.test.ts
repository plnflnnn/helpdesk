import { healthResponseSchema } from '@helpdesk/shared';
import { createTestContext } from '@/test/context.js';

const ctx = createTestContext();
afterAll(() => ctx.close());

describe('GET /api/health', () => {
  it('returns ok when the database is up', async () => {
    const response = await ctx.client().get('/api/health');

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(response.body)).toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });
});

describe('unknown API routes', () => {
  it('return 404 JSON', async () => {
    const response = await ctx.client().get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not found' });
  });
});
