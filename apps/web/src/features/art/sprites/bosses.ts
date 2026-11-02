import { Canvas, type Pt } from '../draw/canvas';
import { book, cog, tube, type EnemyDef } from './enemy-kit';

const S = 96;

const ring = (cx: number, cy: number, rx: number, ry: number, n = 28): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry] as Pt;
  });

const scroll = (c: Canvas, x: number, y: number, w: number, ribbon: 'ember' | 'teal'): void => {
  c.rect(x, y, w, 6, 'parch');
  c.disc(x, y + 3, 3, 'parch');
  c.disc(x + w, y + 3, 3, 'parch');
  c.rect(x + 1, y + 2, w - 2, 1, 'fParch5');
  c.rect(x + Math.floor(w / 2) - 1, y, 2, 6, ribbon);
};

/** A sleepy coiled wyrm sitting on a heap of unfinished homework scrolls. */
export const procrastinationWyrm: EnemyDef = {
  slug: 'procrastination-wyrm',
  name: 'The Procrastination Wyrm',
  size: S,
  ground: 88,
  lunge: 6,
  recoil: 4,
  defeat: 'collapse',
  phase2: { teal: 'ember', ember: 'teal', parch: 'bone' },
  draw: ({ atk, hurt, p2 }) => {
    const c = new Canvas(S, S);
    // homework pile
    for (const x of [16, 34, 52, 70]) scroll(c, x, 83, 14, 'ember');
    for (const x of [25, 43, 61]) scroll(c, x, 77, 14, 'teal');
    for (const x of [34, 52]) scroll(c, x, 71, 14, 'ember');
    // tail resting on the pile
    tube(c, [[78,64],[85,68],[83,75],[76,76]], [5, 4, 3, 1.5], 'teal');
    // three stacked coils
    const coils: [number, number, number, number][] = [[52, 66, 27, 8], [52, 51, 22, 7], [52, 38, 16, 6]];
    for (const [cx, cy, rx, ry] of coils) {
      tube(c, ring(cx, cy, rx, ry), 6.5, 'teal');
      tube(c, ring(cx, cy + 3, rx - 1, ry).filter((p) => p[1] > cy + 3), 2.2, 'gold');
    }
    if (p2) for (let x = 30; x <= 74; x += 11) c.poly([[x, 56], [x + 4, 56], [x + 2, 47]], 'ember');
    // neck and head
    tube(c, [[38,36],[30,30],[27,22],[30,17]], [6, 5.5, 5, 5], 'teal');
    c.ellipse(28,15,12,7,'teal');
    c.rect(11,13,17,8,'teal');
    c.rect(11,atk ? 21 : 19,17,atk ? 5 : 3,'teal');
    c.rect(12,19,15,1,'ink');
    if (atk) { c.rect(13,20,12,4,'ink'); c.poly([[10,18],[10,25],[2,22],[3,19]], 'fEmber'); }
    c.px(13,15,'ink'); c.px(13,17,'ink');
    for (const x of [15, 20, 25]) c.px(x, 20, 'white');
    // horns
    c.poly([[33,9],[44,2],[41,12]], 'bone');
    c.poly([[26,8],[30,2],[31,9]], 'bone');
    // eye: half-lidded and sleepy, wide and angry in phase 2
    if (hurt) c.line(22,12,26,12,'ink');
    else {
      c.rect(22,10,5,4,p2 ? 'fEmber' : 'fGold');
      c.px(23,12,'ink');
      if (!p2) c.rect(22,10,5,2,'teal');
      else c.line(21,8,27,11,'ink', 2);
    }
    return c.shifted(4, 0);
  },
};

/** A towering skeletal archivist: crowned skull, ragged robe, a floating tome and a staff topped with a book. */
export const archivistLich: EnemyDef = {
  slug: 'archivist-lich',
  name: 'The Archivist Lich',
  size: S,
  ground: 88,
  lunge: 6,
  recoil: 4,
  defeat: 'topple',
  phase2: { violet: 'coal', gold: 'ember', teal: 'ember' },
  draw: ({ atk, hurt, p2 }) => {
    const c = new Canvas(S, S);
    // staff and its book charm (back)
    c.rect(77,14,3,74,'wood');
    book(c, 71, 6, 14, 12, 'ember'); c.rect(76,8,4,8,'gold');
    c.disc(78,4,2,'fTeal');
    // robe
    c.poly([[34,36],[66,36],[76,82],[24,82]], 'violet');
    for (let i = 0; i < 9; i++) {
      const x = 24 + i * 5.8;
      c.poly([[x,82],[x + 5.8,82],[x + 2.9,87 + (i % 3)]], 'violet');
    }
    c.rect(48,40,4,42,'gold'); c.rect(26,80,48,2,'gold');
    c.poly([[28,34],[72,34],[74,46],[26,46]], 'violet');
    c.rect(34,45,32,2,'gold');
    // skull, jaw, crown
    c.ellipse(48,22,10,11,'bone');
    c.rect(41,29,14,6,'bone');
    for (const x of [43, 46, 49, 52]) c.rect(x, 31, 1, 4, 'ink');
    c.rect(41,20,5,5,'ink'); c.rect(50,20,5,5,'ink'); c.px(48,26,'ink'); c.px(47,27,'ink');
    if (hurt) { c.line(41,22,45,22,'fTeal5'); c.line(50,22,54,22,'fTeal5'); }
    else { c.rect(42,21,3,3,'fTeal'); c.rect(51,21,3,3,'fTeal'); }
    c.rect(39,9,20,4,'gold');
    for (const x of [39, 46, 53]) c.poly([[x, 9], [x + 3, 3], [x + 6, 9]], 'gold');
    c.px(49,10,p2 ? 'fEmber' : 'fTeal');
    // back arm holds the staff
    c.line(66,40,77,50,'violet',6); c.rect(75,48,5,5,'bone');
    // front arm and the floating tome
    if (atk) {
      c.line(34,40,22,46,'violet',6); c.rect(17,44,6,5,'bone');
      c.rect(8,28,12,16,'parch'); c.rect(22,28,12,16,'parch'); c.rect(20,26,3,20,'ember');
      c.line(2,36,8,34,'fTeal',2);
    } else {
      c.line(34,40,24,52,'violet',6); c.rect(19,50,6,5,'bone');
      c.rect(10,36,12,16,'parch'); c.rect(24,36,12,16,'parch'); c.rect(22,34,3,20,'ember');
      for (let y = 39; y < 50; y += 3) { c.rect(12, y, 8, 1, 'fParch5'); c.rect(26, y, 8, 1, 'fParch5'); }
      for (const [x, y] of [[14, 29], [20, 25], [28, 28], [33, 24]] as const) c.px(x, y, 'fTeal');
    }
    // orbiting books
    book(c, 8, 14, 10, 8, 'teal');
    book(c, 84, 30, 8, 7, 'ember');
    book(c, 10, 68, 10, 8, 'violet');
    if (p2) {
      for (const [x, y] of [[30, 12], [66, 14], [14, 56], [84, 62], [36, 74]] as const) { c.disc(x, y, 2, 'fTeal'); c.px(x, y + 3, 'fTeal5'); }
      book(c, 80, 48, 8, 7, 'ember');
    }
    return c;
  },
};

/** A colossal iron automaton with a clock for a heart, a smokestack and a gear-headed hammer. */
export const clockworkTitan: EnemyDef = {
  slug: 'clockwork-titan',
  name: 'The Clockwork Titan',
  size: S,
  ground: 88,
  lunge: 6,
  recoil: 4,
  defeat: 'topple',
  phase2: { iron: 'coal', gold: 'ember', parch: 'fGold', steel: 'iron' },
  draw: ({ atk, hurt, p2 }) => {
    const c = new Canvas(S, S);
    // smokestack and smoke (back)
    c.rect(68,10,7,16,'coal'); c.rect(66,8,11,3,'iron');
    c.disc(70,6,3,'fCoal6'); c.disc(76,4,2,'fCoal6');
    // legs
    c.rect(32,60,14,28,'iron'); c.rect(54,60,14,28,'iron');
    c.rect(28,84,22,6,'coal'); c.rect(52,84,22,6,'coal');
    cog(c, 39, 72, 4, 'gold'); cog(c, 61, 72, 4, 'gold');
    c.rect(30,54,40,8,'coal');
    // torso with the clock
    c.poly([[24,22],[74,22],[68,56],[30,56]], 'iron');
    c.disc(49,39,15,'gold'); c.disc(49,39,12.5,'parch');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.px(Math.round(49 + Math.cos(a) * 10.5), Math.round(39 + Math.sin(a) * 10.5), 'ink');
    }
    c.line(49,39,49,30,'ink',1); c.line(49,39,56,43,'ink',1); c.disc(49,39,1.5,'gold');
    for (const [x, y] of [[27, 26], [70, 26], [32, 52], [66, 52]] as const) c.px(x, y, 'steel');
    // back arm
    c.ellipse(74,26,8,6,'iron'); c.rect(72,28,10,24,'iron'); c.rect(70,50,14,12,'iron');
    // head
    c.rect(38,5,22,16,'iron');
    c.rect(40,10,14,5,'ink');
    if (hurt) { c.line(41,12,45,12,'fEmber7'); c.line(49,12,53,12,'fEmber7'); }
    else { c.rect(41,11,4,3,'fEmber'); c.rect(49,11,4,3,'fEmber'); }
    c.rect(41,17,14,1,'coal'); c.rect(41,19,14,0,'coal'); c.px(49,4,'gold'); c.px(49,3,'gold');
    // front arm and gear hammer
    c.ellipse(26,26,8,6,'iron');
    if (atk) {
      c.rect(14,28,12,16,'iron'); c.rect(12,42,16,10,'coal');
      c.line(20,50,14,76,'wood',4);
      c.rect(8,72,24,16,'iron'); c.rect(8,72,24,3,'gold'); c.rect(8,85,24,3,'gold');
    } else {
      c.rect(14,28,12,22,'iron'); c.rect(12,48,16,10,'coal');
      c.rect(18,18,4,34,'wood');
      c.rect(8,10,24,16,'iron'); c.rect(8,10,24,3,'gold'); c.rect(8,23,24,3,'gold');
    }
    cog(c, 20, 18, 3, 'gold');
    if (p2) {
      c.line(34,28,40,36,'fEmber',1); c.line(40,36,36,46,'fEmber',1);
      c.line(60,26,64,34,'fEmber',1); c.line(64,34,60,44,'fEmber',1);
      c.line(40,60,38,70,'fEmber',1);
      c.disc(70,6,3,'fEmber5');
    }
    return c;
  },
};
