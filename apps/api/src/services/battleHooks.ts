import type { Db } from '../lib/prisma.js';

/**
 * Called once, inside the battle-finish transaction, the first time a player defeats a boss in a raid
 * (06-battle-screen.md "First clear"). Session 06 deliberately does nothing here: session 07 attaches the
 * boss's cosmetic to it (`unlockCosmetic`). `db` is the finish transaction, so an unlock commits or rolls
 * back together with the XP.
 */
export async function onFirstClear(userId: string, bossSlug: string, db: Db): Promise<void> {
  // Intentionally empty until session 07 (cosmetics); the arguments are the contract that session builds on.
  void [userId, bossSlug, db];
}
