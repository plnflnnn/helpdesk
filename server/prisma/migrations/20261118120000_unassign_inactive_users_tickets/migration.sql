-- Only active users can hold tickets: deactivating a user now returns their tickets to the
-- unassigned queue. Apply that to tickets already assigned to inactive (or deleted) users.
UPDATE "tickets"
SET "assigneeId" = NULL
WHERE "assigneeId" IN (SELECT "id" FROM "users" WHERE "active" = false);
