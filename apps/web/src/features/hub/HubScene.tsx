import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Sprite } from '../art/components/Sprite';
import { PixelGridSvg } from '../art/components/PixelGridSvg';
import { getAsset, isSceneEntry } from '../art/manifest';
import { HUB_PROPS, MARKER_SIZE, type HubPropId } from '../art/sprites/hub-props';
import { SCENE_H, SCENE_W } from '../art/sprites/scene-kit';
import { api } from '../../lib/api';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useSummary } from '../summary/useSummary';
import { hubProps, targetRect } from './hubState';
import styles from './HubScene.module.css';

export const HOME_CONTENT_ID = 'home-content';
/** Two screen pixels per art pixel from here up; one on a phone, so the scene never overflows or shrinks by a fraction. */
export const WIDE_QUERY = '(min-width: 700px)';

interface Props {
  /** The destination the Next best action card chose (session 07): it gets a gold marker. None until then. */
  nextAction?: HubPropId;
}

/**
 * The camp, as the home place: its objects are doors (05c section 7). Each prop is a real link with a name that includes
 * its live state, the same destinations are on the hotbar, nothing is hover-only, and "Skip scene" comes first.
 */
export function HubScene({ nextAction }: Props) {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const summary = useSummary();
  const scale = useMediaQuery(WIDE_QUERY) ? 2 : 1;
  const [lifted, setLifted] = useState<HubPropId | null>(null);
  const entry = getAsset('scene.hub');
  const layers = useMemo(() => (entry && isSceneEntry(entry) ? entry.layers() : null), [entry]);
  const views = hubProps({ summary: summary.data, streak: me.data?.progress.streak ?? 0 });
  if (!layers) return null;
  const scene = { w: SCENE_W, h: SCENE_H };

  const sprite = (id: HubPropId, state: string) => {
    const { box } = HUB_PROPS[id];
    return (
      <span
        key={id}
        className={styles.prop}
        data-lift={lifted === id ? 'true' : undefined}
        style={{ left: box.x * scale, top: box.y * scale }}
      >
        <Sprite id={`prop.${id}`} state={state} scale={scale} decorative />
      </span>
    );
  };
  const layer = (l: 'far' | 'mid' | 'near') => (
    <div key={l} className={styles.layer} data-layer={l} aria-hidden="true">
      <PixelGridSvg grid={layers[l]} scale={scale} />
    </div>
  );
  const props = (where: 'far' | 'mid') => views.filter((v) => HUB_PROPS[v.id].layer === where).map((v) => sprite(v.id, v.state));

  const skip = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(HOME_CONTENT_ID)?.focus();
  };
  const marked = nextAction ? HUB_PROPS[nextAction].hit : null;

  return (
    <section className={styles.hub} aria-label="Camp" style={{ '--s': `${scale}px` } as CSSProperties}>
      <a href={`#${HOME_CONTENT_ID}`} className={styles.skip} onClick={skip}>
        Skip scene
      </a>
      <div className={styles.stage} style={{ width: SCENE_W * scale, height: SCENE_H * scale }} data-scale={scale}>
        {layer('far')}
        {props('far')}
        {layer('mid')}
        {props('mid')}
        {layer('near')}
        {marked && nextAction && (
          <span
            className={styles.marker}
            aria-hidden="true"
            data-testid="next-action-marker"
            style={{
              left: (marked.x + Math.floor(marked.w / 2)) * scale - Math.floor((MARKER_SIZE.w * scale) / 2),
              top: Math.max(0, (marked.y - MARKER_SIZE.h - 3) * scale),
            }}
          >
            <Sprite id="ui.marker" scale={scale} decorative />
          </span>
        )}
        {views.map((v) => {
          const hit = HUB_PROPS[v.id].hit;
          if (!v.to || !hit) return null;
          const r = targetRect(hit, scale, scene);
          return (
            <Link
              key={v.id}
              to={v.to}
              className={styles.hit}
              aria-label={v.name}
              data-prop={v.id}
              data-state={v.state}
              style={r}
              onMouseEnter={() => setLifted(v.id)}
              onMouseLeave={() => setLifted(null)}
              onFocus={() => setLifted(v.id)}
              onBlur={() => setLifted(null)}
            />
          );
        })}
      </div>
    </section>
  );
}
