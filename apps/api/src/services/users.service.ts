import type { Profile, PublicUser, UpdateProfileInput } from '@classifieds/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { notFound } from '../lib/http-error.js';

type UserRow = typeof users.$inferSelect;

function toProfile(row: UserRow): Profile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    phone: row.phone,
    city: row.city,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    phone: row.phone,
    city: row.city,
    createdAt: row.createdAt.toISOString(),
  };
}

async function findUser(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  if (!row) throw notFound('User not found');
  return row;
}

export async function getProfile(userId: string): Promise<Profile> {
  return toProfile(await findUser(userId));
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
  const [row] = await db.update(users).set(input).where(eq(users.id, userId)).returning();
  if (!row) throw notFound('User not found');
  return toProfile(row);
}

export async function getPublicUser(userId: string): Promise<PublicUser> {
  return toPublicUser(await findUser(userId));
}
