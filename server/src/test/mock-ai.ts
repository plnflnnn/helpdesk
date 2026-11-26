import { jest } from '@jest/globals';
import { MockLanguageModelV4 } from 'ai/test';

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;

export const doGenerate = jest.fn<MockLanguageModelV4['doGenerate']>();
export const model = new MockLanguageModelV4({ doGenerate });

/** Makes `aiModel()` return the mock model. Call before importing the app or a job. */
export function mockAi() {
  process.env.OPENAI_API_KEY = 'test-key';
  jest.unstable_mockModule('@ai-sdk/openai', () => ({ createOpenAI: () => () => model }));
}

/** A model reply with the given text, in the shape the AI SDK expects. */
export function modelReply(text: string): GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 5, text: 5, reasoning: 0 },
    },
    warnings: [],
  };
}
