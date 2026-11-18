import request from 'supertest';
import { healthResponseSchema } from '@helpdesk/shared';
import { createApp } from '@/app.js';

describe('GET /api/health', () => {
  it('returns ok when the database is up', async () => {
    const app = createApp({ checkDatabase: async () => true });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(response.body)).toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });

  it('returns 503 when the database is down', async () => {
    const app = createApp({ checkDatabase: async () => false });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 'degraded', database: 'down' });
  });
});

describe('unknown API routes', () => {
  it('return 404 JSON', async () => {
    const app = createApp({ checkDatabase: async () => true });

    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not found' });
  });
});
