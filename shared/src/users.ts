import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'agent']);
/** Role values, e.g. `Role.admin`. Mirrors the Prisma `Role` enum. */
export const Role = roleSchema.enum;
export type Role = z.infer<typeof roleSchema>;

/** Minimum password length, enforced by Better Auth on sign-in and by the set-password endpoint. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  active: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

/** A user as listed on the admin Users page. `pendingInvite` means no password has been set yet. */
export const userListItemSchema = userSchema.extend({ pendingInvite: z.boolean() });
export type UserListItem = z.infer<typeof userListItemSchema>;

export const meResponseSchema = z.object({ user: userSchema });
export type MeResponse = z.infer<typeof meResponseSchema>;

export const listUsersResponseSchema = z.object({ users: z.array(userListItemSchema) });
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;

export const loginInputSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const createAgentInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z
    .email('Enter a valid email address')
    .trim()
    .transform((email) => email.toLowerCase()),
});
export type CreateAgentInput = z.input<typeof createAgentInputSchema>;

export const createAgentResponseSchema = z.object({
  user: userListItemSchema,
  /** Until outbound email exists (Phase 2), the admin copies this link to the new agent. */
  inviteUrl: z.url(),
});
export type CreateAgentResponse = z.infer<typeof createAgentResponseSchema>;

export const updateUserInputSchema = z.object({ active: z.boolean() });
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const updateUserResponseSchema = z.object({ user: userListItemSchema });

export const inviteDetailsSchema = z.object({ name: z.string(), email: z.email() });
export type InviteDetails = z.infer<typeof inviteDetailsSchema>;

export const acceptInviteInputSchema = z.object({
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteInputSchema>;

export const errorResponseSchema = z.object({ error: z.string() });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
