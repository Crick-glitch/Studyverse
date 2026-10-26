import { Sprite } from '../components/Sprite';
import type { NavIconId } from '../sprites/icons';

/** A navigation icon. Decorative unless `label` is given (normally the visible text already names it). */
export function PixelIcon({ name, scale = 2, label }: { name: NavIconId; scale?: number; label?: string }) {
  return <Sprite id={`ui.nav.${name}`} scale={scale} label={label} decorative={!label} />;
}
