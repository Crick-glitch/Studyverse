import type { AnswerResultDto, BattleGearDto } from '@studyverse/shared';
import type { EngineState } from '../battle/types.js';
import type { Battle } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';

/** What `Battle.engineState` holds. Server-only: it contains the open question's answer. */
export interface BattleMeta {
  weapon: BattleGearDto | null;
  armor: BattleGearDto | null;
  perks: string[];
}
export interface StoredBattle {
  v: 1;
  engine: EngineState;
  meta: BattleMeta;
}

export interface BattleExtras {
  lastResult: AnswerResultDto | null;
  log: string[];
}

export function parseStored(row: Battle): StoredBattle {
  const raw = row.engineState as unknown as StoredBattle | null;
  if (!raw || raw.v !== 1 || !raw.engine) {
    throw new AppError(500, 'BATTLE_STATE_INVALID', 'Battle state is unreadable');
  }
  return raw;
}
