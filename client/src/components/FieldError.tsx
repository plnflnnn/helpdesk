import type { FieldError as RhfFieldError } from 'react-hook-form';

/** Inline validation message under a form field. Pair its `id` with the input's `aria-describedby`. */
export function FieldError({ id, error }: { id: string; error?: RhfFieldError }) {
  if (!error?.message) return null;
  return (
    <p id={id} className="text-xs text-destructive" role="alert">
      {error.message}
    </p>
  );
}
