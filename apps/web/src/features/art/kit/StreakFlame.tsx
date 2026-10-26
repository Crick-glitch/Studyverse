import { Sprite } from '../components/Sprite';
import type { FlameLevel } from '../sprites/icons';

/** Same thresholds as the old app: 0 cold, 1-2 days, 3-6, 7-13, 14+. */
export function flameLevelForStreak(days: number): FlameLevel {
  if (!(days > 0)) return 0;
  if (days < 3) return 1;
  if (days < 7) return 2;
  if (days < 14) return 3;
  return 4;
}

export interface StreakFlameProps {
  /** Pass the streak in days, or set the art level directly. */
  streak?: number;
  level?: FlameLevel;
  scale?: number;
}

export function StreakFlame({ streak, level, scale = 3 }: StreakFlameProps) {
  const lv = level ?? flameLevelForStreak(streak ?? 0);
  const text = streak === undefined ? `Streak flame, level ${lv}` : `${streak}-day streak, flame level ${lv}`;
  return <Sprite id={`ui.flame.${lv}`} scale={scale} label={text} />;
}
