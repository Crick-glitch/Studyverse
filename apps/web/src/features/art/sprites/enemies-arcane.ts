import { Canvas } from '../draw/canvas';
import { cog, page, tube, type EnemyDef } from './enemy-kit';

const S = 48;

/** A hovering hooded robe with an empty hood, bone hand and glowing orb staff. */
export const hollowMage: EnemyDef = {
  slug: 'hollow-mage',
  rim: 3,
  name: 'Hollow Mage',
  size: S,
  ground: 43,
  lunge: 4,
  recoil: 3,
  defeat: 'melt',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    c.poly([[21,15],[33,15],[40,33],[14,33]], 'violet');
    const lens = [7, 4, 8, 5, 9, 4, 7];
    lens.forEach((len, i) => {
      const x = 14 + i * 3.7;
      c.poly([[x, 32], [x + 3.7, 32], [x + 1.8, 32 + len]], 'violet');
    });
    c.rect(26,22,2,11,'gold'); c.px(27,25,'fGold'); c.px(27,29,'fGold');
    c.rect(18,31,18,1,'gold');
    // hood with an empty face
    c.ellipse(27,14,8,9,'violet');
    c.ellipse(24,15,5,6,'ink');
    if (hurt) { c.line(20,14,22,14,'fTeal5'); c.line(25,14,27,14,'fTeal5'); }
    else { c.rect(20,13,2,2,'fTeal'); c.rect(25,13,2,2,'fTeal'); if (atk) { c.px(19,13,'fTeal'); c.px(28,13,'fTeal'); } }
    // sleeve, bone hand, staff and orb
    c.line(25,23,17,28,'violet',4);
    c.rect(13,27,4,3,'bone'); c.px(12,28,'bone');
    c.line(11,12,11,37,'wood',2);
    c.rect(9,26,5,2,'gold');
    c.disc(11,9,3.5,'teal');
    c.disc(11,9,1.6,'fTeal');
    if (atk) {
      c.disc(11,9,5.5,'fTeal5'); c.disc(11,9,3.5,'teal'); c.disc(11,9,2,'fTeal');
      c.px(5,5,'fTeal'); c.px(17,4,'fTeal'); c.px(4,12,'fTeal');
    }
    return c.shifted(2, 0);
  },
};

/** A walking bookshelf of iron and gears with a cog on its back. */
export const gearworkGolem: EnemyDef = {
  slug: 'gearwork-golem',
  name: 'Gearwork Golem',
  size: S,
  ground: 43,
  lunge: 4,
  recoil: 3,
  defeat: 'topple',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    c.rect(18,34,7,9,'iron'); c.rect(28,34,7,9,'iron');
    c.rect(16,41,10,3,'coal'); c.rect(27,41,10,3,'coal');
    // bookshelf torso
    c.rect(15,15,22,20,'wood');
    c.rect(17,17,18,16,'coal');
    c.rect(17,25,18,1,'wood');
    const covers = ['ember', 'teal', 'gold', 'violet', 'moss', 'ember'] as const;
    covers.forEach((m, i) => {
      c.rect(17 + i * 3, 25 - [6, 5, 6, 4, 5, 6][i]!, 3, [6, 5, 6, 4, 5, 6][i]!, m);
      c.rect(17 + i * 3, 33 - [6, 4, 5, 6, 5, 4][i]!, 3, [6, 4, 5, 6, 5, 4][i]!, covers[(i + 2) % 6]!);
    });
    c.px(16,16,'gold'); c.px(35,16,'gold'); c.px(16,33,'gold'); c.px(35,33,'gold');
    // back arm and cog
    c.rect(38,17,5,12,'iron'); c.rect(37,28,7,7,'iron');
    cog(c, 39, 12, 4, 'gold');
    // head
    c.rect(20,4,14,12,'iron');
    c.rect(20,8,9,4,'ink');
    if (hurt) { c.line(21,10,23,10,'fTeal5'); c.line(25,10,27,10,'fTeal5'); }
    else { c.rect(21,9,2,2,'fTeal'); c.rect(25,9,2,2,'fTeal'); }
    c.rect(22,13,8,1,'coal'); c.rect(22,15,8,0,'coal');
    c.px(32,6,'gold'); c.px(32,13,'gold');
    // front arm and fist
    c.rect(9,15,7,6,'iron');
    if (atk) {
      c.rect(7,20,7,6,'iron');
      c.rect(7,25,10,9,'iron'); c.line(9,26,9,32,'coal',1); c.line(12,26,12,32,'coal',1);
    } else {
      c.rect(8,20,6,10,'iron');
      c.rect(7,29,10,8,'iron'); c.line(9,30,9,35,'coal',1); c.line(12,30,12,35,'coal',1);
    }
    return c;
  },
};

/** A tall ghost of ink with a torn-page mask, outstretched arms and orbiting pages. */
export const inkwraith: EnemyDef = {
  slug: 'inkwraith',
  rim: 3,
  name: 'Inkwraith',
  size: S,
  ground: 43,
  lunge: 4,
  recoil: 3,
  defeat: 'melt',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    tube(c, [[24,25],[25,32],[30,38],[37,40],[41,35]], [6, 4.5, 3.2, 2.2, 1], 'coal');
    c.poly([[14,22],[34,22],[33,29],[15,29]], 'coal');
    // arms
    tube(c, [[15,24],[9,26],[5,31]], 1.6, 'coal');
    tube(c, [[33,24],[39,24],[42,18]], 1.6, 'coal');
    if (atk) {
      tube(c, [[15,24],[9,24],[5,24]], 1.6, 'coal');
      c.px(3,22,'parch'); c.px(3,24,'parch'); c.px(3,26,'parch');
    } else {
      c.px(4,34,'parch'); c.px(6,35,'parch'); c.px(3,32,'parch');
    }
    c.line(5,31,3,24,'parch',1);
    // head and mask
    c.ellipse(24,14,7,8,'coal');
    c.ellipse(22,15,4.5,5.5,'parch');
    c.rect(18,13,3,3,'ink'); c.rect(23,13,3,3,'ink');
    if (hurt) { c.line(18,14,20,14,'fTeal5'); c.line(23,14,25,14,'fTeal5'); }
    else { c.px(19,14,'fTeal'); c.px(24,14,'fTeal'); if (atk) { c.rect(19,13,2,2,'fTeal'); c.rect(24,13,2,2,'fTeal'); } }
    c.line(19,19,24,19,'ink');
    c.px(21,20,'ink'); c.px(23,20,'ink');
    // floating pages and ink drips
    page(c, 7, 8); page(c, 36, 6); page(c, 38, 36, 4, 5); page(c, 4, 16, 3, 4);
    c.px(8,37,'violet'); c.px(8,40,'violet'); c.px(14,36,'violet'); c.px(14,41,'violet'); c.px(21,38,'violet'); c.px(21,42,'violet');
    return c.shifted(1, 0);
  },
};

/** A book that bites: iron-clasped cover for a jaw, page-teeth, and four stubby legs. */
export const mimicTome: EnemyDef = {
  slug: 'mimic-tome',
  name: 'Mimic Tome',
  size: S,
  ground: 43,
  lunge: 4,
  recoil: 3,
  defeat: 'melt',
  draw: ({ atk, hurt }) => {
    const c = new Canvas(S, S);
    for (const x of [12, 20, 30, 37]) c.rect(x, 40, 4, 4, 'wood');
    // lower half: leather cover under a thick block of pages
    c.rect(8,35,34,5,'ember');
    c.rect(8,35,4,4,'gold'); c.rect(38,35,4,4,'gold');
    c.rect(10,28,30,7,'parch');
    c.rect(11,31,28,1,'fParch5'); c.rect(11,33,28,1,'fParch5');
    c.rect(15,27,16,2,'fEmber5');
    for (let x = 11; x <= 35; x += 6) c.poly([[x,28],[x+3,28],[x+1.5,23]], 'white');
    // spine at the back with gold bands
    c.rect(39,16,5,24,'ember');
    c.rect(39,20,5,2,'gold'); c.rect(39,28,5,2,'gold'); c.rect(39,36,5,2,'gold');
    // lid, hinged at the spine
    const ex = 12, ey = atk ? 20 : 11;
    const hx = 40, hy = 28;
    const dx = ex - hx, dy = ey - hy;
    const len = Math.hypot(dx, dy);
    const px = dy / len, py = -dx / len;
    const q = (t: number, k: number): [number, number] => [hx + dx * t + px * k, hy + dy * t + py * k];
    c.poly([q(0, 0), q(1, 0), q(1, -5), q(0, -5)], 'parch');
    c.poly([q(0, 0), q(1, 0), q(1, 5), q(0, 5)], 'ember');
    c.poly([q(0.12, 6.5), q(0.85, 6.5), q(0.85, 2), q(0.12, 2)], 'gold');
    c.poly([q(0.16, 5.5), q(0.8, 5.5), q(0.8, 3), q(0.16, 3)], 'ember');
    for (const t of [0.2, 0.42, 0.64, 0.86]) {
      const [x, y] = q(t, -5);
      c.poly([[x - 2, y], [x + 1.5, y], [x, y + 4]], 'white');
    }
    const [e1x, e1y] = q(0.6, 4);
    const [e2x, e2y] = q(0.34, 4);
    for (const [x, y] of [[e1x, e1y], [e2x, e2y]] as const) {
      if (hurt) c.line(Math.round(x) - 1, Math.round(y), Math.round(x) + 1, Math.round(y), 'ink');
      else { c.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, 'white'); c.px(Math.round(x) - 1, Math.round(y), 'ink'); }
    }
    c.rect(7,29,8,2,'fEmber5');
    return c;
  },
};

