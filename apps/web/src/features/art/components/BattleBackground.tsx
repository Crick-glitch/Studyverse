import { useMemo } from 'react';
import { getAsset, isSceneEntry, MANIFEST, type Manifest } from '../manifest';
import { SCENE_LAYERS } from '../sprites/scene-kit';
import { PixelGridSvg } from './PixelGridSvg';
import { MissingArt } from './Placeholder';
import { integerScale, labelFor } from './scale';
import styles from './art.module.css';

export interface BattleBackgroundProps {
  /** `dungeon.archive`, `dungeon.library`, `dungeon.foundry`, `scene.camp`, `scene.map`. */
  id: string;
  scale?: number;
  label?: string;
  className?: string;
  manifest?: Manifest;
}

/**
 * A scene as three stacked layers (far, mid, near). Each layer is its own element with `data-layer`, so the
 * battle screen can nudge them by whole pixels for parallax. If the parent is narrower than the scene the
 * edges are cropped (the clear centre stays in view) instead of the art being scaled by a fraction.
 */
export function BattleBackground({ id, scale, label, className, manifest = MANIFEST }: BattleBackgroundProps) {
  const entry = getAsset(id, manifest);
  const layers = useMemo(() => (entry && isSceneEntry(entry) ? entry.layers() : null), [entry]);
  if (!entry || !layers) return <MissingArt id={id} reason={entry ? 'not a scene' : 'missing asset'} />;
  const s = integerScale(scale ?? entry.scale, id);
  return (
    <div
      className={`${styles.stack} ${className ?? ''}`}
      style={{ width: entry.size.w * s, height: entry.size.h * s }}
      role={label === '' ? undefined : 'img'}
      aria-label={label === '' ? undefined : (label ?? labelFor(id))}
      aria-hidden={label === '' ? true : undefined}
      data-asset={id}
      data-scale={s}
    >
      {SCENE_LAYERS.map((l) => (
        <div key={l} className={styles.layer} data-layer={l}>
          <PixelGridSvg grid={layers[l]} scale={s} />
        </div>
      ))}
    </div>
  );
}
