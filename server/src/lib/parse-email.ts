import { createHash } from 'node:crypto';

/** The SendGrid Inbound Parse fields we use. */
type InboundParseFields = {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  /** All the email's headers, as raw text. */
  headers?: string;
  /** JSON: `{ "to": [...], "from": "..." }`, the SMTP envelope. */
  envelope?: string;
};

export type InboundEmail = {
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyText: string;
  /** The `Message-ID` header, or one derived from the content when it has none. */
  messageId: string;
  inReplyTo: string | null;
  /** The thread's Message-IDs, oldest first. */
  references: string[];
  /** Every address the email was sent to (headers and envelope). */
  recipients: string[];
};

/** The email in a form we can store, or null when it has no usable sender. */
export function parseInboundEmail(fields: InboundParseFields): InboundEmail | null {
  const sender = parseAddress(fields.from ?? '');
  if (!sender) {
    return null;
  }
  const headers = parseHeaders(fields.headers ?? '');
  const subject = fields.subject?.trim() || '(no subject)';
  const bodyText = (fields.text?.trim() || htmlToText(fields.html ?? '')).trim();
  return {
    fromEmail: sender.email,
    fromName: sender.name,
    subject,
    bodyText,
    messageId:
      messageIds(headers.get('message-id'))[0] ??
      fallbackMessageId([sender.email, headers.get('date') ?? '', subject, bodyText]),
    inReplyTo: messageIds(headers.get('in-reply-to'))[0] ?? null,
    references: messageIds(headers.get('references')),
    recipients: [...(fields.to?.split(',') ?? []), ...envelopeRecipients(fields.envelope)]
      .map((address) => parseAddress(address)?.email)
      .filter((email) => email !== undefined),
  };
}

/** `"Mia Wong" <Mia@Example.com>` → `{ email: 'mia@example.com', name: 'Mia Wong' }`. */
function parseAddress(value: string): { email: string; name: string | null } | null {
  const angle = /^(.*)<([^<>]+)>\s*$/.exec(value.trim());
  const email = (angle ? angle[2]! : value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    return null;
  }
  const name = angle?.[1]!
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .trim();
  return { email, name: name || null };
}

/** Raw header text → lower-cased name → first value. Folded headers are joined. */
function parseHeaders(raw: string) {
  const headers = new Map<string, string>();
  for (const line of raw.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) {
      continue;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!headers.has(name)) {
      headers.set(name, line.slice(colon + 1).trim());
    }
  }
  return headers;
}

/** A stable Message-ID for an email without one, so webhook retries are still recognised. */
function fallbackMessageId(parts: string[]) {
  const hash = createHash('sha256').update(parts.join('\0')).digest('hex');
  return `<${hash}@inbound.invalid>`;
}

/** Every `<...>` Message-ID in a header value, in order. */
function messageIds(value: string | undefined) {
  return value?.match(/<[^<>\s]+>/g) ?? [];
}

function envelopeRecipients(envelope: string | undefined): string[] {
  if (!envelope) {
    return [];
  }
  try {
    const { to } = JSON.parse(envelope) as { to?: unknown };
    return Array.isArray(to) ? to.filter((address) => typeof address === 'string') : [];
  } catch {
    return [];
  }
}

/** Plain text from an HTML body, for emails without a text part. */
function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n');
}
