import { getAsset, MANIFEST, type Manifest } from '../manifest';
import { ITEM_RARITY, type ItemSlug, type Rarity } from '../sprites/items';
import { Sprite } from './Sprite';
import { MissingArt } from './Placeholder';
import { integerScale, labelFor } from './scale';
import styles from './art.module.css';

export interface ItemIconProps {
  /** `weapon.quillblade`, `armor.iron-plate`. */
  id: string;
  /** Frame colour; defaults to the item's catalog rarity. */
  rarity?: Rarity;
  scale?: number;
  label?: string;
  manifest?: Manifest;
}

/** The icon is 32px inside a 36px frame: 2 art pixels of border on every side. */
const FRAME_PAD = 2;

/** An item icon inside its rarity frame. Frame and icon are separate manifest entries, so either can be re-drawn. */
export function ItemIcon({ id, rarity, scale, label, manifest = MANIFEST }: ItemIconProps) {
  const icon = getAsset(id, manifest);
  if (!icon || (icon.group !== 'item') || id.startsWith('frame.')) return <MissingArt id={id} reason="not an item" />;
  const r = rarity ?? ITEM_RARITY[id.split('.').slice(1).join('.') as ItemSlug] ?? 'common';
  const frame = getAsset(`frame.${r}`, manifest);
  if (!frame) return <MissingArt id={`frame.${r}`} />;
  const s = integerScale(scale ?? icon.scale, id);
  return (
    <span
      className={styles.sprite}
      role="img"
      aria-label={label ?? `${labelFor(id)}, ${r}`}
      style={{ width: frame.size.w * s, height: frame.size.h * s }}
      data-asset={id}
      data-rarity={r}
      data-scale={s}
    >
      <Sprite id={frame.key} scale={s} decorative manifest={manifest} />
      <span style={{ position: 'absolute', left: FRAME_PAD * s, top: FRAME_PAD * s }}>
        <Sprite id={id} scale={s} decorative manifest={manifest} />
      </span>
    </span>
  );
}
