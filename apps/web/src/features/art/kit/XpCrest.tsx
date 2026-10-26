import { Sprite } from '../components/Sprite';
import styles from './kit.module.css';

/** The level crest: pixel shield with the level number in the pixel font. */
export function XpCrest({ level, scale = 3 }: { level: number; scale?: number }) {
  return (
    <span className={styles.crest} role="img" aria-label={`Level ${level}`}>
      <Sprite id="ui.crest" scale={scale} decorative />
      <span className={styles.crestLevel} aria-hidden="true">{level}</span>
    </span>
  );
}
