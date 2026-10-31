import type { AnswerResultDto, BattleGearDto } from '@studyverse/shared';
import type { EngineState } from '../battle/types.js';

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
