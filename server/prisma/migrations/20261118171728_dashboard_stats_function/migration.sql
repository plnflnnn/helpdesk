-- Dashboard metrics, computed in one round trip. Returns JSON in the shape of the API's
-- `DashboardStats` (shared/src/dashboard.ts). `time_zone` (IANA name) decides where each day starts
-- in `ticketsPerDay`; `days` is how many days it covers, ending today.
CREATE FUNCTION dashboard_stats(time_zone text, days integer)
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
    per_day AS (
      -- Timestamps are stored as UTC without a time zone: convert to the viewer's local date.
      SELECT calendar.day, count(tickets.id)::int AS count
      FROM calendar
      LEFT JOIN tickets
        ON (tickets."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE time_zone)::date = calendar.day
      GROUP BY calendar.day
    )
  SELECT jsonb_build_object(
    'totalTickets', (SELECT count(*) FROM tickets),
    'openTickets', (SELECT count(*) FROM tickets WHERE status = 'open'),
    -- Resolved or closed, and every reply came from the AI. AI replies are the only outbound
    -- messages without an author; agent replies always record the agent.
    'resolvedByAi', (
      SELECT count(*)
      FROM tickets
      WHERE status IN ('resolved', 'closed')
        AND EXISTS (
          SELECT 1 FROM messages
          WHERE messages."ticketId" = tickets.id
            AND messages.direction = 'outbound'
            AND messages."authorId" IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM messages
          WHERE messages."ticketId" = tickets.id
            AND messages.direction = 'outbound'
            AND messages."authorId" IS NOT NULL
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
