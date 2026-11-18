import axios from 'axios';
import { listTicketsResponseSchema, type ListTicketsQueryInput } from '@helpdesk/shared';

export const ticketsQueryKey = ['tickets'] as const;

export async function listTickets(query: ListTicketsQueryInput) {
  const { data } = await axios.get('/api/tickets', { params: query });
  return listTicketsResponseSchema.parse(data).tickets;
}
