import { useQuery } from '@tanstack/react-query';
import type { SummaryDto } from '@studyverse/shared';
import { Sprite } from '../features/art/components/Sprite';
import { PixelBar, StreakFlame } from '../features/art/kit';
import { api } from '../lib/api';
import { HeroPortrait, LevelPlate, portraitSource } from './HeroPortrait';
import { SessionChip } from './SessionChip';
import styles from './Hud.module.css';

interface Props {
  /** Phone layout: fewer XP bar segments (fewest while the session chip is showing), a smaller chip, no name. */
  compact: boolean;
  summary: SummaryDto | undefined;
  /** Whether keyboard shortcuts are on (only changes the portrait's tooltip). */
  hotkeys: boolean;
}

const CLASS_NAME = { warrior: 'Warrior', tank: 'Tank', scholar: 'Scholar' } as const;

/**
 * The always-on bar: who you are and what is running. Portrait (a link to the Hero screen), level, XP,
 * energy, streak flame and, only while a session runs, the session chip. Everything comes from GET /me and
 * GET /summary; nothing is invented. Sign-out lives in the Menu, not here.
 */
export function Hud({ compact, summary, hotkeys }: Props) {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const progress = me.data?.progress;
  const profile = me.data?.profile;
  return (
    <header className={styles.hud} data-hud>
      {me.isPending && <span className={styles.status}>Loading…</span>}
      {me.isError && (
        <span role="alert" className={styles.status} title={me.error.message}>
          Profile unavailable
        </span>
      )}
      {profile && progress && (
        <>
          <HeroPortrait
            source={portraitSource(profile)}
            skillPoints={summary?.unspentSkillPoints ?? 0}
            hotkeys={hotkeys}
          />
          <LevelPlate level={progress.level} />
          <div className={styles.identity}>
            {/* Visible on desktop; on a phone only screen readers get the name and class. */}
            <span className={styles.name}>
              {profile.displayName} · Lv {progress.level}
              {profile.playerClass ? <span className={styles.cls}> {CLASS_NAME[profile.playerClass]}</span> : null}
            </span>
            <PixelBar
              tone="xp"
              label="XP to next level"
              value={progress.currentLevelXp}
              max={progress.xpForNextLevel}
              segments={compact ? (summary?.activeSession ? 5 : 8) : 20}
              showNumbers={!compact}
            />
          </div>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <Sprite id="ui.energy" scale={2} decorative />
              <span aria-hidden="true">{progress.studyEnergy}</span>
              <span className={styles.srOnly}>Study energy: {progress.studyEnergy}</span>
            </span>
            <span className={styles.stat}>
              <StreakFlame streak={progress.streak} scale={2} />
              <span aria-hidden="true">{progress.streak}</span>
            </span>
          </div>
        </>
      )}
      {summary?.activeSession && <SessionChip session={summary.activeSession} serverNow={summary.serverNow} compact={compact} />}
    </header>
  );
}
