/** Largest Postgres `integer`. */
const MAX_ID = 2_147_483_647;

export function parseId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id <= MAX_ID ? id : null;
}
