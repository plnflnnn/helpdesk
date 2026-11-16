import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { Role, type User, type UserListItem } from '@helpdesk/shared';
import type { Database } from './db.js';

/** Better Auth's provider id for email/password accounts. */
export const CREDENTIAL_PROVIDER = 'credential';
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
}

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

const listSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  accounts: { where: { providerId: CREDENTIAL_PROVIDER }, select: { id: true } },
} as const;

function toListItem(record: UserRecord & { accounts: { id: string }[] }): UserListItem {
  return { ...toUser(record), pendingInvite: record.accounts.length === 0 };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function listUsers(db: Database): Promise<UserListItem[]> {
  const users = await db.user.findMany({
    select: listSelect,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  return users.map(toListItem);
}

export class EmailTakenError extends Error {
  constructor() {
    super('A user with this email already exists');
  }
}

/** Creates an agent without a password, plus a one-time invite token to set one. */
export async function createAgent(
  db: Database,
  input: { name: string; email: string },
): Promise<{ user: UserListItem; inviteToken: string }> {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new EmailTakenError();
  }

  const inviteToken = randomBytes(32).toString('base64url');
  const user = await db.user.create({
    data: {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      role: Role.agent,
      invites: {
        create: {
          tokenHash: hashToken(inviteToken),
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      },
    },
    select: listSelect,
  });
  return { user: toListItem(user), inviteToken };
}

/**
 * Activates or deactivates a user. Deactivation deletes all of the user's sessions in the same
 * transaction, so they are logged out on their next request.
 */
export async function setUserActive(
  db: Database,
  userId: string,
  active: boolean,
): Promise<UserListItem | null> {
  const existing = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    return null;
  }
  const [user] = await db.$transaction([
    db.user.update({ where: { id: userId }, data: { active }, select: listSelect }),
    ...(active ? [] : [db.session.deleteMany({ where: { userId } })]),
  ]);
  return toListItem(user);
}

async function findUsableInvite(db: Database, token: string) {
  const invite = await db.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt <= new Date() || !invite.user.active) {
    return null;
  }
  return invite;
}

export async function getInviteDetails(db: Database, token: string) {
  const invite = await findUsableInvite(db, token);
  return invite ? { name: invite.user.name, email: invite.user.email } : null;
}

/** Sets the user's password from an invite token. Returns false when the token is not usable. */
export async function acceptInvite(db: Database, token: string, password: string) {
  const invite = await findUsableInvite(db, token);
  if (!invite) {
    return false;
  }
  const passwordHash = await hashPassword(password);
  const userId = invite.userId;

  return db.$transaction(async (tx) => {
    // Claim the invite only if still unused, so two concurrent submissions can't both succeed.
    const { count } = await tx.invite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) {
      return false;
    }

    const existingAccount = await tx.account.findFirst({
      where: { userId, providerId: CREDENTIAL_PROVIDER },
      select: { id: true },
    });
    if (existingAccount) {
      await tx.account.update({
        where: { id: existingAccount.id },
        data: { password: passwordHash },
      });
    } else {
      await tx.account.create({
        data: {
          id: randomUUID(),
          userId,
          accountId: userId,
          providerId: CREDENTIAL_PROVIDER,
          password: passwordHash,
        },
      });
    }
    // Following the invite link proves the user controls the email address.
    await tx.user.update({ where: { id: userId }, data: { emailVerified: true } });
    return true;
  });
}
