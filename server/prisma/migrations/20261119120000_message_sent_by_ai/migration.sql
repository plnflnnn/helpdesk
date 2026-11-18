-- AlterTable
ALTER TABLE "messages" ADD COLUMN "sentByAi" BOOLEAN NOT NULL DEFAULT false;

-- Until now an outbound message without an author was an AI reply (users are only soft-deleted).
UPDATE "messages" SET "sentByAi" = true WHERE direction = 'outbound' AND "authorId" IS NULL;

-- Same metrics as before, with two changes:
-- * AI replies are recognised by "sentByAi" rather than a missing author, so a hard-deleted
--   agent's replies don't count as the AI's.
-- * The per-day count only reads tickets from the window (via the createdAt index), not the
--   whole table.
CREATE OR REPLACE FUNCTION dashboard_stats(time_zone text, days integer)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH
    today AS (
      SELECT (now() AT TIME ZONE time_zone)::date AS day
    ),
    calendar AS (
      SELECT today.day - (days - 1) + offset_days AS day
      FROM today, generate_series(0, days - 1) AS offset_days
    ),
    recent AS (
      -- Timestamps are stored as UTC without a time zone: convert to the viewer's local date.
      -- The filter starts at midnight of the first day in the viewer's zone, converted to UTC.
      SELECT (tickets."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE time_zone)::date AS day
      FROM tickets, today
      WHERE tickets."createdAt" >=
        ((today.day - (days - 1))::timestamp AT TIME ZONE time_zone) AT TIME ZONE 'UTC'
    ),
    per_day AS (
      SELECT calendar.day, count(recent.day)::int AS count
      FROM calendar
      LEFT JOIN recent ON recent.day = calendar.day
      GROUP BY calendar.day
    )
  SELECT jsonb_build_object(
    'totalTickets', (SELECT count(*) FROM tickets),
    'openTickets', (SELECT count(*) FROM tickets WHERE status = 'open'),
    -- Resolved or closed, and every reply came from the AI.
    'resolvedByAi', (
      SELECT count(*)
      FROM tickets
      WHERE status IN ('resolved', 'closed')
        AND EXISTS (
          SELECT 1 FROM messages
          WHERE messages."ticketId" = tickets.id
            AND messages.direction = 'outbound'
            AND messages."sentByAi"
        )
        AND NOT EXISTS (
          SELECT 1 FROM messages
          WHERE messages."ticketId" = tickets.id
            AND messages.direction = 'outbound'
            AND NOT messages."sentByAi"
        )
    ),
    -- From creation to resolution; null when nothing has been resolved.
    'averageResolutionSeconds', (
      SELECT avg(extract(epoch FROM "resolvedAt" - "createdAt"))::float8
      FROM tickets
      WHERE "resolvedAt" IS NOT NULL AND status IN ('resolved', 'closed')
    ),
    'ticketsPerDay', (
      SELECT jsonb_agg(
        jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'count', count)
        ORDER BY day
      )
      FROM per_day
    )
  );
$$;
