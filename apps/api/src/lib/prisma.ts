import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';

export { PrismaClient, Prisma };
/** Either the client or an interactive-transaction client; services accept both. */
export type Db = PrismaClient | Prisma.TransactionClient;

export function createPrisma(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** True for Prisma's "unique constraint failed" error (P2002). */
export function isUniqueViolation(err: unknown, field?: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  if (!field) return true;
  const target = (err.meta as { target?: unknown; driverAdapterError?: unknown } | undefined)
    ?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === 'string') return target.includes(field);
  // Driver-adapter errors keep the constraint info in a different place; fall back to the message.
  return JSON.stringify(err.meta ?? {}).includes(field) || err.message.includes(field);
}
