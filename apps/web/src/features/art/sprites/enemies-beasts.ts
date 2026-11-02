import { Canvas } from '../draw/canvas';
import { tube, type EnemyDef } from './enemy-kit';

const S = 48;

/** Small, hunched, crowned goblin with a studded club. */
export const goblinChieftain: EnemyDef = {
  slug: 'goblin-chieftain',
  name: 'Goblin Chieftain',
  size: S,
  ground: 43,
  lunge: 5,
  recoil: 3,
  defeat: 'topple',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    c.rect(21,36,4,7,'moss'); c.rect(29,36,4,7,'moss');
    c.rect(19,42,6,2,'wood'); c.rect(28,42,6,2,'wood');
    c.ellipse(27,30,8,8,'moss');
    c.poly([[22,24],[32,24],[31,36],[23,36]], 'wood');
    c.rect(22,34,10,2,'gold'); c.rect(23,36,8,3,'ember');
    // back arm
    c.line(32,26,36,32,'moss',3);
    // head with ears
    c.poly([[16,16],[5,12],[15,20]], 'moss');
    c.poly([[28,16],[39,11],[29,20]], 'moss');
    c.ellipse(22,17,7,6,'moss');
    c.rect(18,9,10,3,'gold'); c.px(18,8,'gold'); c.px(22,7,'gold'); c.px(26,8,'gold'); c.px(22,10,'fEmber');
    c.rect(12,18,3,3,'moss');
    if (hurt) {
      c.line(16,15,18,15,'ink'); c.line(21,15,23,15,'ink');
    } else {
      c.rect(16,15,2,2,'fGold'); c.rect(21,15,2,2,'fGold');
      c.line(15,13,18,14,'ink'); c.line(24,13,21,14,'ink');
    }
    c.rect(15,21,9,atk ? 3 : 2,'ink');
    c.px(16,21,'white'); c.px(19,21,'white'); c.px(22,21,'white');
    // arm and club
    c.line(23,26,16,31,'moss',3);
    if (atk) {
      c.line(16,31,9,38,'wood',3);
      c.disc(8,39,4,'wood'); c.px(6,38,'iron'); c.px(8,36,'iron'); c.px(10,41,'iron');
    } else {
      c.line(16,31,12,18,'wood',3);
      c.disc(11,15,4,'wood'); c.px(9,14,'iron'); c.px(11,12,'iron'); c.px(13,16,'iron');
    }
    c.disc(16,31,2,'moss');
    return c;
  },
};

/** Tall, broad-shouldered orc with a horned helm and a huge axe. */
export const orcWarlord: EnemyDef = {
  slug: 'orc-warlord',
  name: 'Orc Warlord',
  size: S,
  ground: 43,
  lunge: 4,
  recoil: 3,
  defeat: 'topple',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    c.rect(21,34,6,9,'coal'); c.rect(30,34,6,9,'coal');
    c.rect(19,41,8,3,'iron'); c.rect(29,41,8,3,'iron');
    c.poly([[16,19],[40,19],[37,35],[20,35]], 'forest');
    c.poly([[20,21],[36,21],[34,33],[22,33]], 'iron');
    c.rect(24,25,8,5,'ember'); c.rect(27,23,2,9,'ember');
    c.rect(20,33,17,3,'wood'); c.rect(26,33,5,3,'gold');
    // back arm
    c.line(38,22,41,30,'forest',4);
    c.ellipse(39,20,4.5,3.5,'iron');
    // head
    c.ellipse(27,12,5.5,5,'forest');
    c.rect(21,6,13,4,'iron');
    c.poly([[21,8],[15,3],[15,9],[21,11]], 'bone');
    c.poly([[34,8],[40,3],[40,9],[34,11]], 'bone');
    if (hurt) { c.line(22,12,24,12,'ink'); c.line(28,12,30,12,'ink'); }
    else { c.rect(22,12,2,2,'fEmber'); c.rect(28,12,2,2,'fEmber'); c.line(21,11,24,12,'ink'); c.line(31,11,28,12,'ink'); }
    c.rect(22,16,9,atk ? 3 : 2,'ink');
    c.rect(22,14,1,3,'white'); c.rect(30,14,1,3,'white');
    // front shoulder, arm, axe
    c.ellipse(17,20,4.5,3.5,'iron');
    c.poly([[15,17],[16,12],[18,17]], 'steel');
    if (atk) {
      c.line(17,24,13,31,'forest',4);
      c.line(30,24,8,34,'wood',2);
      c.poly([[5,34],[1,28],[10,26],[11,36]], 'steel');
      c.poly([[5,34],[2,29],[6,29]], 'white');
    } else {
      c.line(17,24,13,30,'forest',4);
      c.line(12,38,13,6,'wood',2);
      c.poly([[12,4],[4,3],[3,14],[12,12]], 'steel');
      c.poly([[12,6],[6,5],[5,9]], 'white');
    }
    c.disc(13,30,2,'forest');
    return c.shifted(1, 0);
  },
};

/** Low, wide winged hatchling: long neck, tail, and a puff of fire when it strikes. */
export const dragonHatchling: EnemyDef = {
  slug: 'dragon-hatchling',
  name: 'Dragon Hatchling',
  size: S,
  ground: 43,
  lunge: 3,
  recoil: 3,
  defeat: 'topple',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    // far wing then tail
    c.poly([[26,28],[32,7],[36,15],[40,10],[41,28]], 'violet');
    c.line(28,27,33,9,'fViolet7',1); c.line(32,26,40,11,'fViolet7',1);
    tube(c, [[34,34],[39,38],[41,33],[38,28]], [3, 2, 1.2, 1], 'ember');
    c.poly([[37,24],[39,30],[34,28]], 'gold');
    // legs and body
    c.rect(17,37,4,6,'ember'); c.rect(23,38,4,5,'ember'); c.rect(31,37,4,6,'ember'); c.rect(36,38,3,5,'ember');
    c.rect(16,42,5,2,'bone'); c.rect(30,42,5,2,'bone');
    c.ellipse(28,32,11,7,'ember');
    c.ellipse(26,35,8,3,'gold');
    // near wing
    c.poly([[24,26],[22,4],[29,14],[33,8],[35,26]], 'violet');
    c.line(25,25,23,7,'fViolet',1); c.line(29,25,32,10,'fViolet',1);
    // neck and head
    tube(c, [[20,30],[15,22],[14,17]], [4, 3, 3], 'ember');
    c.ellipse(13,15,5,4,'ember');
    c.rect(5,15,8,atk ? 2 : 3,'ember');
    if (atk) { c.rect(5,18,8,2,'ember'); c.rect(6,17,6,1,'ink'); c.poly([[3,16],[3,20],[6,19]], 'fEmber'); }
    c.px(6,14,'ink');
    c.poly([[16,11],[20,5],[19,12]], 'bone');
    c.poly([[12,11],[14,6],[15,11]], 'bone');
    if (hurt) c.line(11,13,13,13,'ink'); else c.rect(11,12,2,2,'fGold');
    return c;
  },
};

/** Crouched cloaked blade-dancer with a streaming scarf and twin daggers. */
export const shadowAssassin: EnemyDef = {
  slug: 'shadow-assassin',
  rim: 3,
  name: 'Shadow Assassin',
  size: S,
  ground: 43,
  lunge: 4,
  recoil: 3,
  defeat: 'topple',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    // scarf streaming back
    tube(c, [[27,19],[32,18],[36,22],[40,20],[42,24]], 1.6, 'ember');
    // legs: wide crouch
    c.line(24,34,17,40,'coal',4); c.line(17,40,15,43,'coal',3); c.rect(12,42,6,2,'violet');
    c.line(27,34,35,38,'coal',4); c.line(35,38,36,43,'coal',3); c.rect(34,42,6,2,'violet');
    // torso leaning forward
    c.poly([[19,21],[29,20],[32,34],[21,36]], 'coal');
    c.rect(21,31,10,2,'violet');
    // hood and face void
    c.ellipse(22,16,6,6,'coal');
    c.rect(15,15,8,5,'ink');
    if (hurt) { c.line(16,17,18,17,'fEmber7'); c.line(20,17,22,17,'fEmber7'); }
    else { c.rect(16,16,2,1,'fEmber'); c.rect(20,16,2,1,'fEmber'); }
    // arms and daggers
    if (atk) {
      c.line(20,24,11,26,'coal',3); c.line(23,26,13,31,'coal',3);
      c.line(11,26,3,24,'steel',1); c.line(13,31,5,33,'steel',1);
      c.px(10,26,'gold'); c.px(12,31,'gold');
    } else {
      c.line(20,25,13,30,'coal',3); c.line(24,27,17,33,'coal',3);
      c.line(13,30,10,22,'steel',1); c.line(17,33,13,37,'steel',1);
      c.px(13,30,'gold'); c.px(17,33,'gold');
    }
    c.px(26,23,'violet'); c.px(27,26,'violet');
    return c.shifted(1, 0);
  },
};

/** Hulking trunk-bodied plant with a giant flower for a head and thorned vine fists. */
export const bloomBrute: EnemyDef = {
  slug: 'bloom-brute',
  name: 'Bloom Brute',
  size: S,
  ground: 43,
  lunge: 4,
  recoil: 3,
  defeat: 'topple',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    c.rect(19,34,6,9,'wood'); c.rect(29,34,6,9,'wood');
    c.rect(15,41,10,3,'wood'); c.rect(28,41,10,3,'wood');
    c.ellipse(27,26,11,10,'moss');
    c.poly([[18,26],[36,26],[34,36],[20,36]], 'wood');
    c.poly([[17,34],[37,34],[39,38],[15,38]], 'moss');
    c.line(23,28,23,34,'forest',1); c.line(29,28,30,34,'forest',1);
    // back vine arm
    tube(c, [[35,22],[41,28],[41,34]], 3, 'moss');
    c.disc(41,36,3.5,'moss'); c.px(43,35,'bone'); c.px(41,39,'bone');
    // front vine arm
    if (atk) {
      tube(c, [[19,22],[11,26],[7,30]], 3, 'moss');
      c.disc(5,31,4.5,'moss'); c.px(2,29,'bone'); c.px(2,33,'bone'); c.px(5,26,'bone');
    } else {
      tube(c, [[19,22],[13,28],[11,35]], 3, 'moss');
      c.disc(11,37,4.5,'moss'); c.px(8,36,'bone'); c.px(8,39,'bone'); c.px(11,42,'bone');
    }
    c.poly([[28,18],[34,14],[33,20]], 'moss');
    // flower head
    const cx = 22, cy = 11;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.disc(cx + Math.cos(a) * 7.2, cy + Math.sin(a) * 6.4, 3, i % 2 ? 'ember' : 'violet');
    }
    c.disc(cx, cy, 5.2, 'gold');
    if (hurt) { c.line(18,10,20,10,'ink'); c.line(24,10,26,10,'ink'); }
    else { c.rect(18,9,2,2,'ink'); c.rect(24,9,2,2,'ink'); c.line(17,8,20,9,'ink'); c.line(27,8,24,9,'ink'); }
    c.rect(19,13,6,atk ? 2 : 1,'ink'); c.px(20,13,'white'); c.px(23,13,'white');
    return c.shifted(1, 0);
  },
};
