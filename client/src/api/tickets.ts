import axios from 'axios';
import {
  listAssigneesResponseSchema,
  listTicketsResponseSchema,
  polishReplyResponseSchema,
  ticketResponseSchema,
  ticketSummaryResponseSchema,
  type ListTicketsQueryInput,
  type ReplyInput,
  type UpdateTicketInput,
} from '@helpdesk/shared';

export const ticketsQueryKey = ['tickets'] as const;
export const ticketQueryKey = (id: number) => ['ticket', id] as const;
export const assigneesQueryKey = ['assignees'] as const;

/** One page of tickets and the total number matching the filters. */
export async function listTickets(query: ListTicketsQueryInput) {
  const { data } = await axios.get('/api/tickets', { params: query });
  return listTicketsResponseSchema.parse(data);
}

export async function getTicket(id: number) {
  const { data } = await axios.get(`/api/tickets/${id}`);
  return ticketResponseSchema.parse(data).ticket;
}

export async function updateTicket(id: number, input: UpdateTicketInput) {
  const { data } = await axios.patch(`/api/tickets/${id}`, input);
  return ticketResponseSchema.parse(data).ticket;
}

/** Saves an agent reply; the ticket comes back with the reply added and its status set to pending. */
export async function addReply(id: number, input: ReplyInput) {
  const { data } = await axios.post(`/api/tickets/${id}/replies`, input);
  return ticketResponseSchema.parse(data).ticket;
}

/** Asks the AI to improve a draft reply; returns the polished text without saving it. */
export async function polishReply(id: number, input: ReplyInput) {
  const { data } = await axios.post(`/api/tickets/${id}/replies/polish`, input);
  return polishReplyResponseSchema.parse(data).bodyText;
}

/** Asks the AI for a short summary of the ticket and its conversation. */
export async function summarizeTicket(id: number) {
  const { data } = await axios.post(`/api/tickets/${id}/summary`);
  return ticketSummaryResponseSchema.parse(data).summary;
}

/** Everyone a ticket can be assigned to. */
export async function listAssignees() {
  const { data } = await axios.get('/api/tickets/assignees');
  return listAssigneesResponseSchema.parse(data).assignees;
}
