import { useEffect, useRef, useState } from 'react';
import { animOf, getAsset, isGridEntry, isSceneEntry, MANIFEST, type GridOptions, type Manifest, type StateAnim } from '../manifest';
import { BattleBackground } from './BattleBackground';
import { PixelGridSvg } from './PixelGridSvg';
import { MissingArt } from './Placeholder';
import { integerScale, labelFor } from './scale';
import { useReducedMotion } from './useReducedMotion';
import styles from './art.module.css';

export interface SpriteProps extends GridOptions {
  /** Manifest key, e.g. `hero.warrior`, `monster.gearwork-golem`, `effect.slash`. */
  id: string;
  state?: string;
  /** Whole-number scale; defaults to the entry's game scale. */
  scale?: number;
  flip?: boolean;
  /**
   * Play the state's frames (idle loops, attack plays once and holds). States with a single frame bob by one
   * art pixel instead; sheets play their frames. Always static under reduced motion.
   */
  animate?: boolean;
  /** Called once when a non-looping state (attack) has shown its last frame. */
  onAnimationDone?: () => void;
  label?: string;
  /** Purely decorative art: hidden from assistive tech (next to a text label, for example). */
  decorative?: boolean;
  className?: string;
  /** Lets tests and tools supply their own manifest. */
  manifest?: Manifest;
}

const isLocal = (src: string): boolean => !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(src) && !/^[a-z][a-z0-9+.-]*:/i.test(src);

function FramePlayer({ frames, play, start, ms = 90, children }: { frames: number; play: boolean; start: number; ms?: number; children: (i: number) => React.ReactNode }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    if (!play) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % frames), ms);
    return () => window.clearInterval(t);
  }, [play, frames, ms]);
  return <>{children(play ? i : start)}</>;
}

/** Steps through a state's frames with per-frame timing. Restarts whenever `restartKey` changes. */
function FrameTimeline({ anim, play, start, restartKey, onDone, children }: { anim: StateAnim; play: boolean; start: number; restartKey: string; onDone?: () => void; children: (i: number) => React.ReactNode }) {
  const [i, setI] = useState(start);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!play) return;
    let n = 0;
    let timer = 0;
    setI(0);
    const step = () => {
      timer = window.setTimeout(() => {
        if (n === anim.frames - 1) {
          if (!anim.loop) {
            done.current?.();
            return;
          }
          n = 0;
        } else n += 1;
        setI(n);
        step();
      }, anim.ms[n] ?? 120);
    };
    step();
    return () => window.clearTimeout(timer);
  }, [play, anim, restartKey]);
  return <>{children(play ? i : start)}</>;
}

export function Sprite({ id, state, scale, flip = false, animate = false, frame, label, decorative = false, className, manifest = MANIFEST, flash, weapon, armor, onAnimationDone }: SpriteProps) {
  const reduced = useReducedMotion();
  const entry = getAsset(id, manifest);
  if (!entry) return <MissingArt id={id} />;
  const s = integerScale(scale ?? entry.scale, id);
  const name = decorative ? undefined : (label ?? labelFor(id));
  const play = animate && !reduced;
  const wrap = (node: React.ReactNode, animated: boolean, bob = animated) => (
    <span
      className={`${styles.sprite} ${bob ? styles.bob : ''} ${className ?? ''}`}
      style={{ ['--px' as string]: `${s}px` }}
      data-asset={id}
      data-scale={s}
      data-animate={animated ? 'true' : undefined}
    >
      {node}
    </span>
  );

  if (isSceneEntry(entry)) return <BattleBackground id={id} scale={s} label={decorative ? undefined : label} className={className} manifest={manifest} />;
  if (isGridEntry(entry)) {
    const st = state && entry.states.includes(state) ? state : (entry.states[0] ?? 'idle');
    if (state && st !== state) return <MissingArt id={`${id}:${state}`} reason="missing state" />;
    const anim = animOf(entry, st);
    const framed = anim.frames > 1;
    const draw = (i: number) => <PixelGridSvg grid={entry.grid(st, { flash, weapon, armor, frame: i })} scale={s} label={name} flip={flip} />;
    if (framed && play) {
      return wrap(
        <FrameTimeline anim={anim} play start={0} restartKey={`${id}|${st}`} onDone={onAnimationDone}>
          {draw}
        </FrameTimeline>,
        true,
        false,
      );
    }
    // not playing: an explicit frame wins, then the state's still frame (impact for attack)
    const shown = Math.min(Math.max(0, frame ?? anim.still), anim.frames - 1);
    // a single-frame hero or monster state keeps the old one-pixel bob
    return wrap(draw(shown), play && !framed && (entry.group === 'hero' || entry.group === 'monster'));
  }
  if (entry.kind === 'sheet') {
    const start = Math.min(Math.max(0, frame ?? (reduced ? Math.floor(entry.frames / 2) : 0)), entry.frames - 1);
    return wrap(
      <FramePlayer frames={entry.frames} play={play} start={start}>
        {(i) => <PixelGridSvg grid={entry.frame(i)} scale={s} label={name} flip={flip} />}
      </FramePlayer>,
      false,
    );
  }
  // svg / image files from the repo. Anything that is not a local path is refused.
  if (!isLocal(entry.src)) return <MissingArt id={id} reason="external src refused" />;
  return wrap(
    <img
      className={styles.file}
      src={entry.src}
      alt={name ?? ''}
      width={entry.size.w * s}
      height={entry.size.h * s}
      style={{ imageRendering: 'pixelated', transform: flip ? 'scaleX(-1)' : undefined }}
    />,
    play,
  );
}
