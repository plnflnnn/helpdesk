import { SparklesIcon } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { REPLY_MAX_LENGTH, replyInputSchema, type ReplyInput } from '@helpdesk/shared';
import { addReply, polishReply, ticketQueryKey, ticketsQueryKey } from '@/api/tickets';
import { FieldError } from '@/components/FieldError';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/errors';

/** Form for an agent to reply on the ticket. Sending sets the ticket to pending. */
export function ReplyForm({ ticketId }: { ticketId: number }) {
  const queryClient = useQueryClient();
  const form = useForm<ReplyInput>({
    resolver: zodResolver(replyInputSchema),
    defaultValues: { bodyText: '' },
  });
  const send = useMutation({
    mutationFn: (input: ReplyInput) => addReply(ticketId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(ticketQueryKey(ticketId), updated);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
    },
  });
  const polish = useMutation({
    mutationFn: (input: ReplyInput) => polishReply(ticketId, input),
    onSuccess: (bodyText) => {
      form.setValue('bodyText', bodyText, { shouldDirty: true, shouldValidate: true });
    },
  });
  const error = form.formState.errors.bodyText;
  const busy = send.isPending || polish.isPending;

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border bg-background p-4"
      onSubmit={form.handleSubmit((data) => send.mutate(data))}
      noValidate
    >
      <Label htmlFor="reply-body">Reply</Label>
      {polish.error && (
        <Alert variant="destructive">
          <AlertDescription>
            Could not polish the reply: {errorMessage(polish.error)}
          </AlertDescription>
        </Alert>
      )}
      {send.error && (
        <Alert variant="destructive">
          <AlertDescription>Could not send the reply: {errorMessage(send.error)}</AlertDescription>
        </Alert>
      )}
      <Textarea
        id="reply-body"
        rows={5}
        placeholder="Write your reply to the student…"
        maxLength={REPLY_MAX_LENGTH}
        readOnly={busy}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'reply-body-error' : undefined}
        {...form.register('bodyText')}
      />
      <FieldError id="reply-body-error" error={error} />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={form.handleSubmit((data) => {
            send.reset();
            polish.mutate(data);
          })}
        >
          <SparklesIcon aria-hidden />
          {polish.isPending ? 'Polishing…' : 'Polish'}
        </Button>
        <Button type="submit" disabled={busy}>
          {send.isPending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}
