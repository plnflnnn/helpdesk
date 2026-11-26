import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { Response } from 'express';
import type { TicketWithMessages } from '@/lib/tickets.js';

/** The configured model, or undefined without an OpenAI key. */
export function aiModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? createOpenAI({ apiKey })(process.env.OPENAI_MODEL || 'gpt-5-mini') : undefined;
}

type AskAiParams = {
  instructions: string;
  prompt: string;
  /** For the error message: "polish the reply", "summarize the ticket". */
  task: string;
};

/**
 * Runs one prompt for a route and returns the trimmed text. On failure responds 503 (no AI key)
 * or 502 (the AI failed or answered nothing) and returns null.
 */
export async function askAi(res: Response, { instructions, prompt, task }: AskAiParams) {
  const model = aiModel();
  if (!model) {
    res.status(503).json({ error: 'AI features are not configured' });
    return null;
  }

  try {
    const { text } = await generateText({
      model,
      instructions,
      prompt,
      maxRetries: 1,
      timeout: 30_000,
    });
    if (text.trim()) {
      return text.trim();
    }
  } catch (error) {
    console.error(`AI request failed (${task})`, error);
  }
  res.status(502).json({ error: `The AI service could not ${task}. Try again.` });
  return null;
}

/** The conversation as plain text, oldest first, each message labelled with its sender. */
export function formatConversation(ticket: TicketWithMessages) {
  const studentName = ticket.student.name ?? ticket.student.email;
  return ticket.messages
    .map((message) => {
      const sender =
        message.direction === 'inbound'
          ? `Student (${studentName})`
          : `Agent (${message.author?.name ?? 'Support'})`;
      return `${sender}, ${message.createdAt.toISOString()}:\n${message.bodyText}`;
    })
    .join('\n\n---\n\n');
}
