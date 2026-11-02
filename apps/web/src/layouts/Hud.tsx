import { useQuery } from '@tanstack/react-query';
import type { SummaryDto } from '@studyverse/shared';
import { Link } from 'react-router-dom';
import { Sprite } from '../features/art/components/Sprite';
import { PixelBar, StreakFlame } from '../features/art/kit';
import { api } from '../lib/api';
import { plural } from '../lib/format';
import { useMediaQuery } from '../lib/useMediaQuery';
import { NARROW_QUERY } from './breakpoints';
import { HeroPortrait, LevelPlate, portraitSource } from './HeroPortrait';
import { HERO_ROUTE } from './nav';
import { SessionChip } from './SessionChip';
import styles from './Hud.module.css';

interface Props {
  /** `bar`: the slim top row (phones and tablets). `panel`: the player card at the top of the desktop camp panel. */
  variant?: 'bar' | 'panel';
  /** Phone layout of the bar: fewer XP bar segments (fewest while the session chip is showing), a smaller chip, no name. */
  compact: boolean;
  summary: SummaryDto | undefined;
  /** Whether keyboard shortcuts are on (only changes the portrait's tooltip). */
  hotkeys: boolean;
}

const CLASS_NAME = { warrior: 'Warrior', tank: 'Tank', scholar: 'Scholar' } as const;
/** 17 segments is what fills the panel's inner width exactly (each segment is 12 px with its gap). */
const PANEL_SEGMENTS = 17;

type Me = NonNullable<ReturnType<typeof useMe>['data']>;
function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.me });
}

/** Energy and streak, each with a visible label (a bare "4" next to an icon does not say what it counts). */
function Resources({ progress, panel }: { progress: Me['progress']; panel: boolean }) {
  return (
    <div className={panel ? styles.resources : styles.stats}>
      <span className={panel ? styles.res : styles.stat}>
        <Sprite id="ui.energy" scale={2} decorative />
        <span className={styles.resText}>
          <span className={styles.resNum} aria-hidden="true">
            {progress.studyEnergy}
          </span>
          <span className={styles.resLabel} aria-hidden="true">
            Energy
          </span>
        </span>
        <span className={styles.srOnly}>Study energy: {progress.studyEnergy}</span>
      </span>
      <span className={panel ? styles.res : styles.stat}>
        <StreakFlame streak={progress.streak} scale={2} />
        <span className={styles.resText}>
          <span className={styles.resNum} aria-hidden="true">
            {progress.streak}
          </span>
          <span className={styles.resLabel} aria-hidden="true">
            Streak
          </span>
        </span>
      </span>
    </div>
  );
}

/**
 * The always-on player info: who you are and what is running. Portrait (a link to the Hero screen), level, XP,
 * energy, streak and, only while a session runs, the session chip. Everything comes from GET /me and GET /summary;
 * nothing is invented. Sign-out lives in the Menu, not here.
 * Two shapes of the same data: a slim top bar on phones and tablets, and a card at the top of the desktop camp panel.
 */
export function Hud({ variant = 'bar', compact, summary, hotkeys }: Props) {
  const me = useMe();
  const progress = me.data?.progress;
  const profile = me.data?.profile;
  const panel = variant === 'panel';
  const narrow = useMediaQuery(NARROW_QUERY);
  const status = (
    <>
      {me.isPending && <span className={styles.status}>Loading…</span>}
      {me.isError && (
        <span role="alert" className={styles.status} title={me.error.message}>
          Profile unavailable
        </span>
      )}
    </>
  );

  if (panel) {
    return (
      <header className={styles.panel} data-hud>
        {status}
        {profile && progress && (
          <>
            <div className={styles.who}>
              <HeroPortrait source={portraitSource(profile)} skillPoints={summary?.unspentSkillPoints ?? 0} hotkeys={hotkeys} scale={3} />
              <div className={styles.pId}>
                <span className={styles.pName}>{profile.displayName}</span>
                <span className={styles.pSub}>
                  Level {progress.level}
                  {profile.playerClass ? ` · ${CLASS_NAME[profile.playerClass]}` : ''}
                </span>
              </div>
            </div>
            <div className={styles.xp}>
              <PixelBar tone="xp" label="XP to next level" value={progress.currentLevelXp} max={progress.xpForNextLevel} segments={PANEL_SEGMENTS} showNumbers={false} className={styles.xpBar} />
              <div className={styles.xpText} aria-hidden="true">
                <span>XP</span>
                <span>
                  {progress.currentLevelXp} / {progress.xpForNextLevel}
                </span>
              </div>
            </div>
            <Resources progress={progress} panel />
            {(summary?.unspentSkillPoints ?? 0) > 0 && (
              <Link to={HERO_ROUTE} className={styles.skills} aria-label={`Spend ${plural(summary?.unspentSkillPoints ?? 0, 'skill point')}`}>
                <span className={styles.bang} aria-hidden="true">
                  !
                </span>
                <span aria-hidden="true">{plural(summary?.unspentSkillPoints ?? 0, 'skill point')} to spend</span>
              </Link>
            )}
          </>
        )}
        {summary?.activeSession && <SessionChip session={summary.activeSession} serverNow={summary.serverNow} wide />}
      </header>
    );
  }

  return (
    <header className={styles.hud} data-hud>
      {status}
      {profile && progress && (
        <>
          <HeroPortrait source={portraitSource(profile)} skillPoints={summary?.unspentSkillPoints ?? 0} hotkeys={hotkeys} />
          <LevelPlate level={progress.level} />
          <div className={styles.identity}>
            {/* Visible from tablet up; on a phone only screen readers get the name and class. */}
            <span className={styles.name}>
              {profile.displayName} · Lv {progress.level}
              {profile.playerClass ? <span className={styles.cls}> {CLASS_NAME[profile.playerClass]}</span> : null}
            </span>
            <PixelBar tone="xp" label="XP to next level" value={progress.currentLevelXp} max={progress.xpForNextLevel} segments={compact ? (summary?.activeSession ? (narrow ? 4 : 5) : 8) : 20} showNumbers={!compact} />
          </div>
          <Resources progress={progress} panel={false} />
        </>
      )}
      {summary?.activeSession && <SessionChip session={summary.activeSession} serverNow={summary.serverNow} compact={compact} />}
    </header>
  );
}
