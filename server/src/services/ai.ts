import { generateText, type LanguageModel } from 'ai';
import type { TicketDetail } from '@helpdesk/shared';
import { badGateway, serviceUnavailable } from '@/errors.js';

/** The configured model; responds 503 when there is none (no OpenAI key). */
export function requireModel(model: LanguageModel | undefined): LanguageModel {
  if (!model) {
    throw serviceUnavailable('AI features are not configured');
  }
  return model;
}

type GenerateParams = {
  model: LanguageModel;
  instructions: string;
  prompt: string;
  /** What we were doing, for error messages: "polish the reply", "summarize the ticket". */
  task: string;
};

/** Runs one prompt and returns the trimmed text. Responds 502 when the AI service fails or returns nothing. */
export async function generate({ model, instructions, prompt, task }: GenerateParams) {
  let text: string;
  try {
    ({ text } = await generateText({
      model,
      instructions,
      prompt,
      maxRetries: 1,
      timeout: 30_000,
    }));
  } catch (error) {
    console.error(`AI request failed (${task})`, error);
    throw badGateway(`The AI service could not ${task}. Try again.`);
  }

  const result = text.trim();
  if (!result) {
    throw badGateway(`The AI service returned an empty response. Try again.`);
  }
  return result;
}

/** The ticket's messages as plain text, oldest first, each labelled with its sender. */
export function formatConversation(ticket: TicketDetail) {
  const studentName = ticket.student.name ?? ticket.student.email;
  return ticket.messages
    .map((message) => {
      const sender =
        message.direction === 'inbound'
          ? `Student (${studentName})`
          : `Agent (${message.author?.name ?? 'Support'})`;
      return `${sender}, ${message.createdAt}:\n${message.bodyText}`;
    })
    .join('\n\n---\n\n');
}
