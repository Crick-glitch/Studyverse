import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BattleBackground, PixelGridSvg, Sprite } from '../components';
import { animOf, entryStates, isGridEntry, isSceneEntry, MANIFEST, type AssetEntry, type AssetGroup, type GridEntry } from '../manifest';
import { ATTACK_PHASES } from '../sprites/frames';
import { PixelBar, PixelButton, PixelPanel, SkillNode, StreakFlame, XpCrest, InventorySlot } from '../kit';
import { ItemIcon } from '../components';
import { ARMOR_SLUGS, WEAPON_SLUGS } from '../sprites/hero';
import { NAV_ICON_IDS } from '../sprites/icons';
import styles from './DevArtPage.module.css';

const GROUPS: { id: AssetGroup; title: string }[] = [
  { id: 'hero', title: 'Heroes' },
  { id: 'monster', title: 'Enemies and bosses' },
  { id: 'item', title: 'Items and rarity frames' },
  { id: 'avatar', title: 'Avatars and portraits' },
  { id: 'scene', title: 'Scenes (far / mid / near)' },
  { id: 'effect', title: 'Effects' },
  { id: 'ui', title: 'UI icons, flames, crest' },
];

/** Replays a one-shot state (attack) every couple of seconds so it can be reviewed without reloading. */
function Replay({ entry, state }: { entry: GridEntry; state: string }) {
  const [run, setRun] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setRun((n) => n + 1), 1600);
    return () => window.clearTimeout(t);
  }, [run]);
  return <Sprite key={run} id={entry.key} state={state} animate />;
}

const frameLabel = (state: string, i: number): string => (state === 'attack' ? (ATTACK_PHASES[i] ?? `frame ${i + 1}`) : `frame ${i + 1}`);

const Checker = ({ children }: { children: ReactNode }) => <span className={styles.checker}>{children}</span>;

function StateCells({ entry }: { entry: AssetEntry }) {
  if (isSceneEntry(entry)) {
    const l = entry.layers();
    return (
      <div>
        <BattleBackground id={entry.key} scale={1} />
        <div className={styles.layers}>
          {(['far', 'mid', 'near'] as const).map((k) => (
            <figure key={k} className={styles.cell}>
              <Checker>
                <PixelGridSvg grid={l[k]} scale={1} label={`${entry.key} ${k} layer`} />
              </Checker>
              <figcaption>{k}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }
  if (entry.kind === 'sheet') {
    return (
      <div className={styles.states}>
        {Array.from({ length: entry.frames }, (_, i) => (
          <figure key={i} className={styles.cell}>
            <Checker>
              <Sprite id={entry.key} frame={i} scale={entry.scale} />
            </Checker>
            <figcaption>frame {i + 1}</figcaption>
          </figure>
        ))}
        <figure className={styles.cell}>
          <Checker>
            <Sprite id={entry.key} animate scale={entry.scale} />
          </Checker>
          <figcaption>playing</figcaption>
        </figure>
      </div>
    );
  }
  return (
    <div className={styles.states}>
      {entryStates(entry).flatMap((st) => {
        const frames = isGridEntry(entry) ? animOf(entry, st).frames : 1;
        return Array.from({ length: frames }, (_, i) => (
          <figure key={`${st}-${i}`} className={styles.cell}>
            <Checker>
              <Sprite id={entry.key} state={st} frame={frames > 1 ? i : undefined} scale={1} />
            </Checker>
            <Checker>
              <Sprite id={entry.key} state={st} frame={frames > 1 ? i : undefined} />
            </Checker>
            <figcaption>
              {st}
              {frames > 1 ? ` - ${frameLabel(st, i)}` : ''}
              {isGridEntry(entry) && entry.group === 'monster' && st === 'hit' ? ' (flash below)' : ''}
            </figcaption>
          </figure>
        ));
      })}
      {isGridEntry(entry) && entryStates(entry).some((st) => animOf(entry, st).frames > 1) ? (
        <figure className={styles.cell}>
          <Checker>
            <Sprite id={entry.key} animate />
          </Checker>
          <Checker>
            <Replay entry={entry} state="attack" />
          </Checker>
          <figcaption>playing: idle loop, attack replay</figcaption>
        </figure>
      ) : null}
      {entry.group === 'monster' ? (
        <figure className={styles.cell}>
          <Checker>
            <Sprite id={entry.key} state="hit" flash />
          </Checker>
          <figcaption>hit + flash</figcaption>
        </figure>
      ) : null}
    </div>
  );
}

/** Development-only art review: every asset, every state, at 1x and at its game scale. */
export default function DevArtPage() {
  const entries = useMemo(() => Object.values(MANIFEST), []);
  return (
    <main className={styles.page}>
      <h1>Art review</h1>
      <p className={styles.note}>
        {entries.length} manifest assets. Development only: this route is not part of the production build.
      </p>
      <nav className={styles.nav} aria-label="Asset groups">
        {GROUPS.map((g) => (
          <a key={g.id} href={`#${g.id}`}>
            {g.title}
          </a>
        ))}
        <a href="#gear">Hero gear</a>
        <a href="#kit">Pixel UI kit</a>
        <a href="#fallback">Fallbacks</a>
      </nav>

      {GROUPS.map((g) => (
        <PixelPanel key={g.id} id={g.id} title={`${g.title} (${entries.filter((e) => e.group === g.id).length})`}>
          <div className={styles.grid}>
            {entries
              .filter((e) => e.group === g.id)
              .map((e) => (
                <figure key={e.key} className={styles.card}>
                  <StateCells entry={e} />
                  <figcaption>{e.key}</figcaption>
                </figure>
              ))}
          </div>
        </PixelPanel>
      ))}

      <PixelPanel id="gear" title="Hero gear: every weapon and armor on the Warrior">
        <div className={styles.grid}>
          {WEAPON_SLUGS.map((w) => (
            <figure key={w} className={styles.card}>
              <Checker>
                <Sprite id="hero.warrior" weapon={w} />
              </Checker>
              <figcaption>{w}</figcaption>
            </figure>
          ))}
          {ARMOR_SLUGS.map((a) => (
            <figure key={a} className={styles.card}>
              <Checker>
                <Sprite id="hero.warrior" armor={a} />
              </Checker>
              <figcaption>{a}</figcaption>
            </figure>
          ))}
        </div>
      </PixelPanel>

      <PixelPanel id="kit" title="Pixel UI kit">
        <div className={styles.grid}>
          <PixelButton variant="primary">Primary</PixelButton>
          <PixelButton>Secondary</PixelButton>
          <PixelButton variant="danger">Danger</PixelButton>
          <PixelButton disabled>Disabled</PixelButton>
          <PixelButton pressed aria-pressed="true">Pressed</PixelButton>
        </div>
        <div className={styles.grid}>
          <PixelBar label="Hero HP" tone="hp" value={64} max={100} />
          <PixelBar label="XP" tone="xp" value={30} max={100} />
          <PixelBar label="Focus" tone="focus" value={2} max={3} segments={3} />
          <PixelBar label="Enemy HP" tone="enemy" value={90} max={100} />
        </div>
        <div className={styles.grid}>
          <InventorySlot label="Quillblade, rare weapon" rarity="rare" selected onClick={() => undefined}>
            <ItemIcon id="weapon.quillblade" />
          </InventorySlot>
          <InventorySlot label="Iron plate, uncommon armor" rarity="uncommon">
            <ItemIcon id="armor.iron-plate" />
          </InventorySlot>
          <InventorySlot label="Empty weapon slot" empty />
          <SkillNode state="unlocked" label="Power Strike" cost={1} description="+2 ATK" />
          <SkillNode state="available" label="Berserk" cost={3} description="+30% damage while HP < 50%" onClick={() => undefined} />
          <SkillNode state="locked" label="Executioner" cost={3} description="+25% damage vs enemies < 30% HP" />
          {[0, 2, 5, 10, 20].map((d) => (
            <StreakFlame key={d} streak={d} />
          ))}
          <XpCrest level={7} />
        </div>
        <div className={styles.grid}>
          {NAV_ICON_IDS.map((n) => (
            <figure key={n} className={styles.cell}>
              <Sprite id={`ui.nav.${n}`} scale={3} />
              <figcaption>{n}</figcaption>
            </figure>
          ))}
        </div>
      </PixelPanel>

      <PixelPanel id="fallback" title="Fallbacks (these are meant to look unfinished)">
        <div className={styles.grid}>
          <Sprite id="monster.does-not-exist" />
          <Sprite id="hero.warrior" state="no-such-state" />
        </div>
      </PixelPanel>
    </main>
  );
}
