import axios from 'axios';
import {
  listAssigneesResponseSchema,
  listTicketsResponseSchema,
  ticketResponseSchema,
  type ListTicketsQueryInput,
  type UpdateTicketInput,
} from '@helpdesk/shared';

export const ticketsQueryKey = ['tickets'] as const;
export const ticketQueryKey = (id: number) => ['ticket', id] as const;
export const assigneesQueryKey = ['assignees'] as const;

export async function listTickets(query: ListTicketsQueryInput) {
  const { data } = await axios.get('/api/tickets', { params: query });
  return listTicketsResponseSchema.parse(data).tickets;
}

export async function getTicket(id: number) {
  const { data } = await axios.get(`/api/tickets/${id}`);
  return ticketResponseSchema.parse(data).ticket;
}

export async function updateTicket(id: number, input: UpdateTicketInput) {
  const { data } = await axios.patch(`/api/tickets/${id}`, input);
  return ticketResponseSchema.parse(data).ticket;
}

/** Everyone a ticket can be assigned to. */
export async function listAssignees() {
  const { data } = await axios.get('/api/tickets/assignees');
  return listAssigneesResponseSchema.parse(data).assignees;
}
