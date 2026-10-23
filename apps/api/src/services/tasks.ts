import {
  BALANCE,
  startOfUtcDay,
  type TaskCompleteResultDto,
  type TaskCreate,
  type TaskDto,
  type TaskPatch,
} from '@studyverse/shared';
import type { Task } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { withPlayerLock } from '../lib/playerLock.js';
import type { PrismaClient } from '../lib/prisma.js';
import { grantXp } from '../lib/xp.js';
import { ensurePlayer, toProgressDto } from './player.js';
import { touchStreak } from './streak.js';

export const toTaskDto = (t: Task): TaskDto => ({
  id: t.id,
  title: t.title,
  difficulty: t.difficulty,
  subject: t.subject,
  status: t.status,
  rewardXp: BALANCE.taskXp[t.difficulty],
  rewarded: t.rewardedAt !== null,
  completedAt: t.completedAt?.toISOString() ?? null,
  createdAt: t.createdAt.toISOString(),
});

const notFound = () => new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

export async function listTasks(
  prisma: PrismaClient,
  userId: string,
  q: {
    status?: 'open' | 'completed' | undefined;
    difficulty?: TaskDto['difficulty'] | undefined;
    subject?: string | undefined;
  },
): Promise<TaskDto[]> {
  await ensurePlayer(prisma, userId);
  const rows = await prisma.task.findMany({
    where: {
      userId,
      ...(q.status && { status: q.status }),
      ...(q.difficulty && { difficulty: q.difficulty }),
      ...(q.subject && { subject: q.subject }),
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  });
  return rows.map(toTaskDto);
}

export async function createTask(
  prisma: PrismaClient,
  userId: string,
  input: TaskCreate,
): Promise<TaskDto> {
  await ensurePlayer(prisma, userId);
  const open = await prisma.task.count({ where: { userId, status: 'open' } });
  if (open >= 500)
    throw new AppError(
      409,
      'TOO_MANY_TASKS',
      'You have 500 open tasks. Finish or delete some first.',
    );
  return toTaskDto(
    await prisma.task.create({
      data: { userId, title: input.title, difficulty: input.difficulty, subject: input.subject },
    }),
  );
}

export async function updateTask(
  prisma: PrismaClient,
  userId: string,
  id: string,
  patch: TaskPatch,
): Promise<TaskDto> {
  const task = await prisma.task.findFirst({ where: { id, userId } });
  if (!task) throw notFound();
  if (patch.difficulty && patch.difficulty !== task.difficulty && task.rewardedAt)
    throw new AppError(
      409,
      'TASK_ALREADY_REWARDED',
      'A task that already paid out cannot change difficulty.',
    );
  const res = await prisma.task.updateMany({ where: { id, userId }, data: patch });
  if (res.count === 0) throw notFound();
  return toTaskDto(await prisma.task.findFirstOrThrow({ where: { id, userId } }));
}

export async function deleteTask(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const res = await prisma.task.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw notFound();
}

/**
 * Completing a task is idempotent and never pays twice:
 *  - the task pays only while `rewardedAt` is empty AND the ledger accepts source ("task", id);
 *  - re-opening and re-completing finds `rewardedAt` set (and the ledger row) and pays nothing;
 *  - only `dailyRewardedCompletions` completions per UTC day pay XP (self-reported work can be farmed).
 */
export async function completeTask(
  prisma: PrismaClient,
  userId: string,
  id: string,
  now: Date,
): Promise<TaskCompleteResultDto> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(prisma, userId, async (tx) => {
    const task = await tx.task.findFirst({ where: { id, userId } });
    if (!task) throw notFound();

    let note: TaskCompleteResultDto['reward']['note'] = task.rewardedAt
      ? 'already_paid'
      : 'daily_cap_reached';
    let xp = 0;
    let levelsGained = 0;
    let skillPointsAwarded = 0;

    if (task.status === 'open') {
      await tx.task.update({ where: { id }, data: { status: 'completed', completedAt: now } });
      if (task.rewardedAt) note = 'already_paid';
      else {
        const paidToday = await tx.xpTransaction.count({
          where: { userId, sourceType: 'task', createdAt: { gte: startOfUtcDay(now) } },
        });
        if (paidToday >= BALANCE.tasks.dailyRewardedCompletions) note = 'daily_cap_reached';
        else {
          const grant = await grantXp(
            {
              userId,
              amount: BALANCE.taskXp[task.difficulty],
              reason: `Task: ${task.title}`.slice(0, 120),
              sourceType: 'task',
              sourceId: task.id,
            },
            tx,
          );
          await tx.task.update({ where: { id }, data: { rewardedAt: now } });
          if (grant.granted) {
            note = 'paid';
            xp = grant.amount;
            levelsGained = grant.levelsGained;
            skillPointsAwarded = grant.skillPointsAwarded;
            await touchStreak(tx, userId, now);
          } else note = 'already_paid';
        }
      }
    }
    const fresh = await tx.task.findFirstOrThrow({ where: { id, userId } });
    const progress = toProgressDto(
      await tx.playerProgress.findUniqueOrThrow({ where: { userId } }),
    );
    return {
      task: toTaskDto(fresh),
      reward: { xp, note, levelsGained, skillPointsAwarded },
      progress,
    };
  });
}

/** Re-open a completed task. It never refunds XP, and completing it again never pays again. */
export async function reopenTask(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<TaskDto> {
  const task = await prisma.task.findFirst({ where: { id, userId } });
  if (!task) throw notFound();
  if (task.status === 'open') return toTaskDto(task);
  const res = await prisma.task.updateMany({
    where: { id, userId, status: 'completed' },
    data: { status: 'open', completedAt: null },
  });
  void res;
  return toTaskDto(await prisma.task.findFirstOrThrow({ where: { id, userId } }));
}
