import { requireModel } from '@/services/ai.js';

describe('requireModel', () => {
  it('responds 503 when no model is configured', () => {
    expect(() => requireModel(undefined)).toThrow(
      expect.objectContaining({ status: 503, message: 'AI features are not configured' }),
    );
  });
});
