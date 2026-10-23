import {
  BALANCE,
  displayNameSchema,
  displayNameKey,
  LEGACY_EMOJI_TO_PRESET,
  normalizeText,
  type ImportPreflightDto,
  type ImportReportDto,
  type ImportRequest,
} from '@studyverse/shared';
import type { Prisma as PrismaNs } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { withPlayerLock } from '../lib/playerLock.js';
import { isUniqueViolation, type PrismaClient } from '../lib/prisma.js';
import { grantXp } from '../lib/xp.js';
import { SKILLS } from '../seed/catalog.js';
import {
  legacySkillSlug,
  mapCard,
  mapSession,
  mapTask,
  normalizedName,
  payloadHash,
} from './importMap.js';
import { ensurePlayer, toProgressDto } from './player.js';

const L = BALANCE.importLimits;

export async function preflight(prisma: PrismaClient, userId: string): Promise<ImportPreflightDto> {
  const { progress } = await ensurePlayer(prisma, userId);
  const [tasks, sessions, flashcards] = await Promise.all([
    prisma.task.count({ where: { userId } }),
    prisma.studySession.count({ where: { userId } }),
    prisma.flashcard.count({ where: { userId } }),
  ]);
  return {
    hasProgress: progress.totalXp > 0 || tasks + sessions + flashcards > 0,
    existing: { totalXp: progress.totalXp, tasks, sessions, flashcards },
  };
}

const NOT_IMPORTED = [
  'Study energy, raid wins/losses and unspent skill points: the server earns these now, so they are not copied.',
  'Attribute-training purchases (Power/Fortify/Focus): stats are derived from level, class, gear and skills.',
  'Streak: the server counts it from your next verified activity.',
  'Avatar images and old emoji pictures: illustrated avatars replace them (a preset is chosen when it matches).',
  'Timer state and UI preferences.',
];

/**
 * Imports the old localStorage data into the signed-in account. Safe by construction:
 *  - the same payload (hash) never imports twice: a retry returns the earlier report;
 *  - an account that already has progress needs an explicit onExistingProgress = "merge";
 *  - all XP comes in as ONE ledger row (legacy_import, not leaderboard-eligible), only once per account;
 *  - tasks arrive already "rewarded" (no XP is re-awarded); sessions arrive as history only;
 *  - skill points are re-derived from the level; skills are unlocked only if affordable and in order.
 */
export async function importLocal(
  prisma: PrismaClient,
  userId: string,
  req: ImportRequest,
  now: Date,
): Promise<ImportReportDto> {
  await ensurePlayer(prisma, userId);
  const { payload } = req;
  const hash = payloadHash(payload);

  try {
    return await withPlayerLock(prisma, userId, (tx) => run(tx, userId, req, hash, now), {
      timeoutMs: 60_000,
    });
  } catch (err) {
    // Two identical imports racing: the loser hits the unique (userId, payloadHash) key.
    if (isUniqueViolation(err)) {
      const earlier = await prisma.importBatch.findUnique({
        where: { userId_payloadHash: { userId, payloadHash: hash } },
      });
      if (earlier?.report) return { ...(earlier.report as unknown as ImportReportDto), alreadyImported: true };
    }
    throw err;
  }
}

async function run(
  tx: PrismaNs.TransactionClient,
  userId: string,
  req: ImportRequest,
  hash: string,
  now: Date,
): Promise<ImportReportDto> {
  const { payload } = req;
  const progressDto = async () =>
    toProgressDto(await tx.playerProgress.findUniqueOrThrow({ where: { userId } }));

  const earlier = await tx.importBatch.findUnique({
    where: { userId_payloadHash: { userId, payloadHash: hash } },
  });
  if (earlier?.report)
    return {
      ...(earlier.report as unknown as ImportReportDto),
      alreadyImported: true,
      progress: await progressDto(),
    };

  const pf = await (async () => {
    const p = await tx.playerProgress.findUniqueOrThrow({ where: { userId } });
    const [t, s, f] = await Promise.all([
      tx.task.count({ where: { userId } }),
      tx.studySession.count({ where: { userId } }),
      tx.flashcard.count({ where: { userId } }),
    ]);
    return p.totalXp > 0 || t + s + f > 0;
  })();
  if (pf && req.onExistingProgress !== 'merge')
    throw new AppError(
      409,
      'EXISTING_PROGRESS',
      'This account already has progress. Confirm that you want to merge the old data into it.',
    );

  const report: ImportReportDto = {
    alreadyImported: false,
    imported: { xp: 0, tasks: 0, sessions: 0, flashcards: 0, skills: 0, items: 0, profileFields: [] },
    skipped: [],
    notImported: NOT_IMPORTED,
    notes: [],
    progress: await progressDto(),
  };
  const skip = (what: string, count: number, reason: string) => {
    if (count > 0) report.skipped.push({ what, count, reason });
  };

  /* ---- XP (one ledger row, once per account) ---- */
  const legacyXp = Math.floor(Math.max(0, payload.totalXP ?? 0));
  if (legacyXp > 0) {
    const amount = Math.min(legacyXp, L.maxLegacyXp);
    const grant = await grantXp(
      {
        userId,
        amount,
        reason: 'Imported from the old StudyVerse',
        sourceType: 'legacy_import',
        sourceId: 'local-storage',
        leaderboardEligible: false,
      },
      tx,
    );
    if (grant.granted) {
      report.imported.xp = amount;
      report.notes.push(
        `Your ${amount} XP were imported as one entry that does not count for the leaderboard. ` +
          `Your level was recalculated with the new curve (the old app showed level ${Math.floor(payload.level ?? 1)}).`,
      );
      if (amount < legacyXp) report.notes.push(`XP above ${L.maxLegacyXp} was capped.`);
    } else skip('XP', 1, 'legacy XP was already imported for this account');
  }

  /* ---- tasks ---- */
  const existingTasks = new Set(
    (await tx.task.findMany({ where: { userId }, select: { title: true, difficulty: true } })).map(
      (t) => `${normalizeText(t.title)}|${t.difficulty}`,
    ),
  );
  let bad = 0;
  let dupes = 0;
  for (const raw of payload.tasks) {
    const t = mapTask(raw);
    if ('error' in t) {
      bad += 1;
      continue;
    }
    const key = `${normalizeText(t.title)}|${t.difficulty}`;
    if (existingTasks.has(key)) {
      dupes += 1;
      continue;
    }
    existingTasks.add(key);
    await tx.task.create({
      data: {
        userId,
        title: t.title,
        difficulty: t.difficulty,
        status: t.completed ? 'completed' : 'open',
        // Completed tasks are marked as already rewarded: importing never pays task XP again.
        ...(t.completed && { completedAt: now, rewardedAt: now }),
        ...(t.createdAt && { createdAt: t.createdAt }),
      },
    });
    report.imported.tasks += 1;
  }
  skip('tasks', bad, 'not valid tasks');
  skip('tasks', dupes, 'you already have a task with the same title and difficulty');

  /* ---- sessions (history only; no XP, no energy) ---- */
  const seenSessions = new Set(
    (
      await tx.studySession.findMany({
        where: { userId, outcomeReason: 'imported' },
        select: { title: true, subject: true, plannedMinutes: true, finishedAt: true },
      })
    ).map((s) => `${s.title}|${s.subject}|${s.plannedMinutes}|${s.finishedAt?.toISOString() ?? ''}`),
  );
  bad = 0;
  dupes = 0;
  for (const raw of payload.sessions) {
    const s = mapSession(raw);
    if ('error' in s) {
      bad += 1;
      continue;
    }
    const key = `${s.title}|${s.subject}|${s.plannedMinutes}|${s.finishedAt?.toISOString() ?? ''}`;
    if (seenSessions.has(key)) {
      dupes += 1;
      continue;
    }
    seenSessions.add(key);
    await tx.studySession.create({
      data: {
        userId,
        title: s.title,
        subject: s.subject,
        difficulty: s.difficulty,
        plannedMinutes: s.plannedMinutes,
        status: s.validated ? 'claimed' : 'abandoned',
        outcomeReason: 'imported',
        startedAt: s.finishedAt,
        finishedAt: s.finishedAt,
        focusRatioReported: s.focusRatio,
        xpAwarded: 0,
        energyAwarded: 0,
      },
    });
    report.imported.sessions += 1;
  }
  skip('sessions', bad, 'not valid sessions');
  skip('sessions', dupes, 'already imported');

  /* ---- flashcards -> one deck ---- */
  if (payload.flashcards.length > 0) {
    let deck = await tx.flashcardDeck.findFirst({ where: { userId, name: L.importedDeckName } });
    deck ??= await tx.flashcardDeck.create({
      data: { userId, name: L.importedDeckName, subject: 'Other' },
    });
    const seen = new Set(
      (await tx.flashcard.findMany({ where: { deckId: deck.id }, select: { question: true } })).map(
        (c) => normalizeText(c.question),
      ),
    );
    let room = BALANCE.flashcards.maxCardsPerUser - (await tx.flashcard.count({ where: { userId } }));
    bad = 0;
    dupes = 0;
    let full = 0;
    let placeholders = 0;
    for (const raw of payload.flashcards) {
      const c = mapCard(raw);
      if ('error' in c) {
        bad += 1;
        continue;
      }
      const key = normalizeText(c.question);
      if (seen.has(key)) {
        dupes += 1;
        continue;
      }
      if (room <= 0) {
        full += 1;
        continue;
      }
      seen.add(key);
      room -= 1;
      const rawWrong = (raw as { answers?: unknown[] }).answers ?? [];
      if (rawWrong.length > c.distractors.length + 1) placeholders += 1;
      await tx.flashcard.create({
        data: {
          deckId: deck.id,
          userId,
          question: c.question,
          answer: c.answer,
          distractors: c.distractors,
          subject: c.subject,
          ease: c.ease,
          intervalDays: c.intervalDays,
          repetitions: c.repetitions,
          dueAt: c.dueAt ?? now,
        },
      });
      report.imported.flashcards += 1;
    }
    skip('flashcards', bad, 'missing question or answer');
    skip('flashcards', dupes, 'a card with the same question is already in the deck');
    skip('flashcards', full, 'card limit reached');
    if (placeholders > 0)
      report.notes.push(
        `${placeholders} card(s) had placeholder wrong answers (such as "N/A"); those were dropped.`,
      );
  }

  /* ---- skills: re-derived points, in dependency order ---- */
  const wanted = new Set(
    Object.entries(payload.unlockedSkills ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => legacySkillSlug(k)),
  );
  if (wanted.size > 0) {
    const have = new Set(
      (await tx.playerSkill.findMany({ where: { userId }, select: { skill: { select: { slug: true } } } })).map(
        (p) => p.skill.slug,
      ),
    );
    let points = (await tx.playerProgress.findUniqueOrThrow({ where: { userId } })).skillPoints;
    let unlocked = 0;
    let unaffordable = 0;
    for (const def of SKILLS) {
      if (!wanted.has(def.slug) || have.has(def.slug)) continue;
      if (!def.prerequisites.every((p) => have.has(p)) || def.cost > points) {
        unaffordable += 1;
        continue;
      }
      const row = await tx.skillDefinition.findUnique({ where: { slug: def.slug } });
      if (!row) continue;
      await tx.playerSkill.create({ data: { userId, skillId: row.id } });
      await tx.playerProgress.update({ where: { userId }, data: { skillPoints: { decrement: def.cost } } });
      points -= def.cost;
      have.add(def.slug);
      unlocked += 1;
    }
    report.imported.skills = unlocked;
    skip('skills', unaffordable, 'not enough skill points at your recalculated level, or a prerequisite was missing');
    const unknown = [...wanted].filter((w) => !SKILLS.some((s) => s.slug === w)).length;
    skip('skills', unknown, 'unknown skill');
  }

  /* ---- equipment by item name ---- */
  const equip = payload.equipment ?? {};
  const slots: ['weapon' | 'armor', unknown][] = [
    ['weapon', equip.weapon],
    ['armor', equip.armor],
  ];
  for (const [slot, rawItem] of slots) {
    const name = (rawItem as { name?: unknown } | null | undefined)?.name;
    if (typeof name !== 'string') continue;
    const defs = await tx.itemDefinition.findMany({ where: { slot } });
    const def = defs.find((d) => normalizedName(d.name) === normalizedName(name));
    if (!def) {
      skip('items', 1, `"${name.slice(0, 40)}" is not an item in the new game`);
      continue;
    }
    const current = await tx.equipment.findUnique({ where: { userId } });
    const occupied = slot === 'weapon' ? current?.weaponItemId : current?.armorItemId;
    if (occupied) {
      skip('items', 1, `your ${slot} slot is already filled`);
      continue;
    }
    const item = await tx.playerItem.create({
      data: { userId, itemDefinitionId: def.id, source: 'legacy_import' },
    });
    await tx.equipment.upsert({
      where: { userId },
      update: slot === 'weapon' ? { weaponItemId: item.id } : { armorItemId: item.id },
      create: { userId, ...(slot === 'weapon' ? { weaponItemId: item.id } : { armorItemId: item.id }) },
    });
    report.imported.items += 1;
  }

  /* ---- profile: class, name (only while still the default), preset avatar ---- */
  const profile = await tx.playerProfile.findUniqueOrThrow({ where: { id: userId } });
  const patch: PrismaNs.PlayerProfileUpdateInput = {};
  if (!profile.playerClass && payload.playerClass && ['warrior', 'tank', 'scholar'].includes(payload.playerClass)) {
    patch.playerClass = payload.playerClass as 'warrior' | 'tank' | 'scholar';
    report.imported.profileFields.push('class');
  }
  const nameCheck = displayNameSchema.safeParse(payload.avatarName ?? '');
  if (
    nameCheck.success &&
    /^Adventurer-/.test(profile.displayName) &&
    nameCheck.data.toLowerCase() !== 'adventurer'
  ) {
    const taken = await tx.playerProfile.findUnique({
      where: { displayNameKey: displayNameKey(nameCheck.data) },
      select: { id: true },
    });
    if (!taken) {
      patch.displayName = nameCheck.data;
      patch.displayNameKey = displayNameKey(nameCheck.data);
      report.imported.profileFields.push('name');
    } else skip('profile', 1, `the name "${nameCheck.data}" is already taken`);
  }
  const preset = payload.avatarEmoji ? LEGACY_EMOJI_TO_PRESET[payload.avatarEmoji] : undefined;
  if (preset && !profile.avatarKey) {
    patch.avatarKey = preset;
    report.imported.profileFields.push('avatar');
  }
  if (Object.keys(patch).length > 0) await tx.playerProfile.update({ where: { id: userId }, data: patch });

  const archive = payload.raidHistory.slice(0, L.maxRaidHistory);
  if (archive.length > 0) report.notes.push(`${archive.length} old raid history entries were archived with this import (not shown in the game).`);

  report.progress = await progressDto();
  await tx.importBatch.create({
    data: {
      userId,
      payloadHash: hash,
      status: 'completed',
      report: { ...report, archive: { raidHistory: archive } } as unknown as PrismaNs.InputJsonValue,
    },
  });
  return report;
}
