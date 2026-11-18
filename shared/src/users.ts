import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'agent']);
/** Role values, e.g. `Role.admin`. Mirrors the Prisma `Role` enum. */
export const Role = roleSchema.enum;
export type Role = z.infer<typeof roleSchema>;

/** Password length limits, enforced by Better Auth on sign-in and by the users endpoints. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Field schemas, reused by the input schemas below.

const nameSchema = z.string().trim().min(1, 'Name is required').max(100);

const emailSchema = z
  .email('Enter a valid email address')
  .trim()
  .transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

// Users.

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  active: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const listUsersResponseSchema = z.object({ users: z.array(userSchema) });
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;

/** Response of `/api/me` and of the create and update user endpoints. */
export const userResponseSchema = z.object({ user: userSchema });
export type UserResponse = z.infer<typeof userResponseSchema>;

// Inputs.

export const loginInputSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/** An admin creates a user with an initial password. */
export const createUserInputSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema.default(Role.agent),
});
/** What the client sends (`role` is optional). */
export type CreateUserInput = z.input<typeof createUserInputSchema>;
/** What the server receives after parsing (`role` is filled in). */
export type CreateUserData = z.output<typeof createUserInputSchema>;

/** An admin updates any subset of a user's fields. A new password replaces the old one. */
export const updateUserInputSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
    active: z.boolean(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update');
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Errors.

export const errorResponseSchema = z.object({ error: z.string() });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
