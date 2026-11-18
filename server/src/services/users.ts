import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { Role, type CreateUserData, type UpdateUserInput, type User } from '@helpdesk/shared';
import type { Database } from '@/db.js';
import { conflict, forbidden, notFound } from '@/errors.js';
import type { UserRecord } from '@/types.js';

const EMAIL_TAKEN = 'A user with this email already exists';
const USER_NOT_FOUND = 'User not found';
const ADMIN_NOT_DELETABLE = 'Admins cannot be deleted';

/** The columns needed to build a `User`. */
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export function toUser(record: UserRecord): User {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    active: record.active,
    createdAt: record.createdAt.toISOString(),
  };
}

/** Users that aren't deleted: active ones first, then by name. */
export async function listUsers(db: Database): Promise<User[]> {
  const users = await db.user.findMany({
    where: { deletedAt: null },
    select: userSelect,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  return users.map(toUser);
}

type CreateUserParams = {
  db: Database;
  data: CreateUserData;
};

/** Creates a user who can sign in right away with the given password. */
export async function createUser({ db, data }: CreateUserParams): Promise<User> {
  await assertEmailAvailable({ db, email: data.email });

  const userId = randomUUID();
  const user = await db.user.create({
    data: {
      id: userId,
      name: data.name,
      email: data.email,
      role: data.role,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          password: await hashPassword(data.password),
        },
      },
    },
    select: userSelect,
  });
  return toUser(user);
}

type UpdateUserParams = {
  db: Database;
  userId: string;
  data: UpdateUserInput;
};

export async function updateUser({ db, userId, data }: UpdateUserParams): Promise<User> {
  await findExistingUser({ db, userId });
  if (data.email) {
    await assertEmailAvailable({ db, email: data.email, exceptUserId: userId });
  }

  const { password, ...fields } = data;
  const passwordHash = password ? await hashPassword(password) : undefined;
  const logOut = data.active === false || passwordHash !== undefined;

  const user = await db.$transaction(async (tx) => {
    if (passwordHash) {
      // Sign-in is email/password only, so each user has exactly one account: the one holding the password.
      await tx.account.updateMany({
        where: { userId },
        data: { password: passwordHash },
      });
    }
    if (logOut) {
      await tx.session.deleteMany({ where: { userId } });
    }
    return tx.user.update({
      where: { id: userId },
      data: fields,
      select: userSelect,
    });
  });
  return toUser(user);
}

type DeleteUserParams = {
  db: Database;
  userId: string;
};

/**
 * Soft-deletes an agent: marks them deleted and inactive (so they can't sign in), ends their
 * sessions and returns their tickets to the unassigned queue. The row stays, so messages they
 * sent keep their author. Admins can't be deleted.
 */
export async function deleteUser({ db, userId }: DeleteUserParams): Promise<void> {
  const user = await findExistingUser({ db, userId });
  if (user.role === Role.admin) {
    throw forbidden(ADMIN_NOT_DELETABLE);
  }

  await db.$transaction([
    db.session.deleteMany({ where: { userId } }),
    db.ticket.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } }),
    db.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), active: false },
    }),
  ]);
}

type FindExistingUserParams = {
  db: Database;
  userId: string;
};

/** The user with this id, unless they don't exist or were deleted (404). */
async function findExistingUser({ db, userId }: FindExistingUserParams) {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) {
    throw notFound(USER_NOT_FOUND);
  }
  return user;
}

type AssertEmailAvailableParams = {
  db: Database;
  email: string;
  /** The user being updated: their own current email doesn't count as taken. */
  exceptUserId?: string;
};

/** Throws 409 when another user (not `exceptUserId`) already has this email. */
async function assertEmailAvailable({ db, email, exceptUserId }: AssertEmailAvailableParams) {
  const owner = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (owner && owner.id !== exceptUserId) {
    throw conflict(EMAIL_TAKEN);
  }
}
