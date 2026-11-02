import type { PlayerClass } from '@studyverse/shared';
import { Link } from 'react-router-dom';
import { Sprite } from '../features/art/components/Sprite';
import { PORTRAIT_FRAME_SIZE, PORTRAIT_WINDOW } from '../features/art/sprites/icons';
import { plural } from '../lib/format';
import { HERO_HOTKEY, HERO_ROUTE } from './nav';
import styles from './HeroPortrait.module.css';

/** The API's preset keys and the art's bust ids were named separately; this is the one place they meet. */
const PRESET_TO_BUST: Readonly<Record<string, string>> = {
  student: 'student',
  mage: 'wizard',
  ranger: 'elf',
  scientist: 'scientist',
  teacher: 'teacher',
  guardian: 'knight',
};
/** Which art-pixel corner of the sprite shows in the 18 x 18 frame window (centred on the face). */
const BUST_CORNER = { x: 7, y: 3 }; // 32 x 32 avatar busts
const PORTRAIT_CORNER = { x: 12, y: 7 }; // 40 x 40 class portraits

export interface PortraitSource {
  id: string;
  corner: { x: number; y: number };
}

/** The equipped hero bust: the chosen avatar preset, else the class portrait, else the student bust. */
export function portraitSource(p: { avatarKey: string | null; playerClass: PlayerClass | null }): PortraitSource {
  const bust = p.avatarKey ? PRESET_TO_BUST[p.avatarKey] : undefined;
  if (bust) return { id: `avatar.${bust}`, corner: BUST_CORNER };
  if (p.playerClass) return { id: `portrait.${p.playerClass}`, corner: PORTRAIT_CORNER };
  return { id: 'avatar.student', corner: BUST_CORNER };
}

interface Props {
  source: PortraitSource;
  /** Unspent skill points: a "!" appears on the frame when there are any. */
  skillPoints: number;
  hotkeys: boolean;
  /** Screen pixels per art pixel: 2 in the top bar (48 px frame), 3 in the desktop panel (72 px frame). */
  scale?: number;
}

/** HUD portrait: the hero bust in a gold frame. It is the link to the Hero screen; a gold "!" marks unspent skill points. */
export function HeroPortrait({ source, skillPoints, hotkeys, scale = 2 }: Props) {
  const SCALE = scale;
  const frame = PORTRAIT_FRAME_SIZE * SCALE;
  return (
    <Link
      to={HERO_ROUTE}
      className={styles.portrait}
      title={hotkeys ? `Hero (${HERO_HOTKEY})` : 'Hero'}
      style={{ width: frame, height: frame }}
    >
      <span
        className={styles.window}
        aria-hidden="true"
        style={{
          left: PORTRAIT_WINDOW.x * SCALE,
          top: PORTRAIT_WINDOW.y * SCALE,
          width: PORTRAIT_WINDOW.w * SCALE,
          height: PORTRAIT_WINDOW.h * SCALE,
        }}
      >
        <span className={styles.bust} style={{ left: -source.corner.x * SCALE, top: -source.corner.y * SCALE }}>
          <Sprite id={source.id} scale={SCALE} decorative />
        </span>
      </span>
      <span className={styles.frame} aria-hidden="true">
        <Sprite id="ui.portrait-frame" scale={SCALE} decorative />
      </span>
      {skillPoints > 0 && (
        <span className={styles.bang} aria-hidden="true">
          !
        </span>
      )}
      <span className={styles.srOnly}>
        Hero{skillPoints > 0 ? `, ${plural(skillPoints, 'unspent skill point')}` : ''}
      </span>
    </Link>
  );
}

/** Phones hide the name line, so the level gets its own small plate next to the portrait (desktop shows "Lv 4" in the name). */
export function LevelPlate({ level }: { level: number }) {
  return (
    <span className={styles.level} aria-hidden="true">
      <span className={styles.lv}>LV</span>
      {level}
    </span>
  );
}
