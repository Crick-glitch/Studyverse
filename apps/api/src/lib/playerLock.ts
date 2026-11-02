import { AppError } from './errors.js';
import type { Prisma, PrismaClient } from './prisma.js';

type Tx = Prisma.TransactionClient;

/**
 * Locks the player's PlayerProgress row (SELECT ... FOR UPDATE) for the rest of the transaction, so two
 * requests that change the same player's session/task state queue up instead of racing. `grantXp` takes
 * the same lock, so everything a request does for one player is serialised.
 */
export async function lockPlayer(tx: Tx, userId: string): Promise<void> {
  await tx.playerProgress.createMany({ data: [{ userId }], skipDuplicates: true });
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "PlayerProgress" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Player profile not found');
}

/** Runs `fn` in one transaction with the player locked. Long imports pass a longer timeout. */
export function withPlayerLock<T>(
  prisma: PrismaClient,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await lockPlayer(tx, userId);
      return fn(tx);
    },
    { timeout: opts.timeoutMs ?? 15_000, maxWait: 10_000 },
  );
}
