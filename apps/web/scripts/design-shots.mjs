// Design review harness: screenshots + layout measurements of the signed-in shell at the five review viewports.
//   node scripts/design-shots.mjs <label> [screen-prefix]     -> docs/redesign/<label>/<screen>-<WxH>.png and metrics.json
// Needs PW_CHROMIUM_PATH (or an installed Playwright Chromium). Uses the same mock API as route-shots.mjs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { API_BASE, SUPABASE_URL, STORAGE_KEY, fakeSession, respond, runningSession } from './mock-api.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? 'after';
const only = process.argv[3] ?? '';
const outDir = join(here, '..', '..', '..', 'docs', 'redesign', label);
mkdirSync(outDir, { recursive: true });

export const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
];

process.env.VITE_SUPABASE_URL = SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fake-publishable-key';
process.env.VITE_API_BASE_URL = API_BASE;
const server = await createServer({ root: join(here, '..'), logLevel: 'error', server: { port: 5197, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
const problems = [];
const metricsFile = join(outDir, 'metrics.json');
const metrics = existsSync(metricsFile) ? JSON.parse(readFileSync(metricsFile, 'utf8')) : {}; // merge, so partial runs add to it

async function open(vp, scenario = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([k, s]) => { try { localStorage.setItem(k, JSON.stringify(s)); } catch { /* ignore */ } }, [STORAGE_KEY, fakeSession()]);
  await ctx.route(`${API_BASE}/**`, async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = respond(req.method(), new URL(req.url()).pathname, scenario);
    if (body === undefined) return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"code":"NOT_FOUND","message":"No mock"}}' });
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route(`${SUPABASE_URL}/**`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`); });
  return { ctx, page };
}

// Layout facts that decide whether the shell "fits": how much of the viewport is chrome, how much width the content gets, what is clipped.
const MEASURE = () => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const q = (s) => document.querySelector(s);
  const vw = window.innerWidth, vh = window.innerHeight;
  const hud = q('[data-hud]'), hotbar = q('[data-hotbar]'), main = q('#main-content');
  const bar = hotbar?.querySelector('nav');
  const scene = q('section[aria-label="Camp"] [data-scale]');
  const firstCard = main?.querySelector('section:not([aria-label="Camp"]), article, [class*="card"], [class*="panel"]');
  const clipped = [];
  for (const el of document.querySelectorAll('[data-hud] *, [data-hotbar] *, [data-rail] *')) {
    const cs = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && el.clientWidth > 0) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0].slice(0, 28)} ${el.scrollWidth}>${el.clientWidth}`);
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) clipped.push(`ELLIPSIS ${el.textContent?.slice(0, 24)}`);
  }
  const fontOf = (s) => { const e = q(s); return e ? `${getComputedStyle(e).fontSize} ${getComputedStyle(e).fontFamily.split(',')[0]}` : null; };
  const portrait = q('[data-hud] a[href="/camp"], [data-rail] a[href="/camp"]');
  const chromeTop = hud ? hud.getBoundingClientRect().height : 0;
  return {
    viewport: `${vw}x${vh}`, hud: r(hud), hotbar: r(bar), main: r(main), scene: r(scene), portrait: r(portrait),
    chromeHeightPx: Math.round((hud && getComputedStyle(hud).position !== 'static' && hud.getBoundingClientRect().width >= vw - 2 ? chromeTop : 0) + (bar && getComputedStyle(hotbar).position === 'fixed' && bar.getBoundingClientRect().width > 100 && bar.getBoundingClientRect().height < 200 ? bar.getBoundingClientRect().height + 12 : 0)),
    firstCardTop: firstCard ? Math.round(firstCard.getBoundingClientRect().top) : null,
    nameFont: fontOf('[data-hud] header span, [data-hud] [class*="name"], [data-rail] [class*="name"]'),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    clipped,
  };
};

async function shot(vp, name, path, { scenario = {}, after, measure = false } = {}) {
  if (only && !name.startsWith(only)) return;
  const { ctx, page } = await open(vp, scenario);
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
  if (after) await after(page);
  if (measure) {
    const m = await page.evaluate(MEASURE);
    metrics[`${name}@${vp.name}`] = m;
    // Real clipping in the HUD / hotbar / panel. Not counted: screen-reader-only spans (1 px by design), the name that is
    // visually hidden on phones, and the portrait window (a bust cropped on purpose).
    const real = m.clipped.filter((c) => !/_srOnly_|_name_|window|ELLIPSIS/.test(c));
    if (real.length) problems.push(`${name}@${vp.name}: clipped ${real.join('; ')}`);
    if (m.overflowX > 0) problems.push(`${name}@${vp.name}: horizontal overflow ${m.overflowX}px`);
  }
  await page.screenshot({ path: join(outDir, `${name}-${vp.name}.png`) });
  await ctx.close();
}

// Battle screen: layout facts (no sideways scroll, nothing wider than its box, how much of the screen the field and panel use).
const MEASURE_BATTLE = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom) }; };
  const field = document.querySelector('[data-testid="battlefield"]');
  const panel = document.querySelector('[aria-label="Your turn"]') ?? document.querySelector('[aria-label="Battle rewards"]');
  const clipped = [];
  for (const el of document.querySelectorAll('[data-battle] *')) {
    const cs = getComputedStyle(el);
    if (el.closest('[data-asset]') || el.tagName === 'svg' || el.tagName === 'path') continue;
    if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !/field|bg|log|srOnly/.test(String(el.className))) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0].slice(0, 30)} ${el.scrollWidth}>${el.clientWidth}`);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !el.closest('[data-testid="battlefield"]')) clipped.push(`OFFSCREEN ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0].slice(0, 30)} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  for (const plate of document.querySelectorAll('[data-battle] [data-side]')) {
    const pr = plate.getBoundingClientRect();
    for (const child of plate.querySelectorAll('*')) {
      const r = child.getBoundingClientRect();
      if (r.width > 0 && r.right > pr.right + 1) { clipped.push(`PLATE-SPILL ${child.tagName.toLowerCase()}.${String(child.className).split(' ')[0].slice(0, 24)} +${Math.round(r.right - pr.right)}px`); break; }
    }
  }
  const small = [...document.querySelectorAll('[data-battle] p, [data-battle] li, [data-battle] span, [data-battle] button')].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12).map((e) => e.textContent.trim().slice(0, 20));
  const tooSmallTargets = [...document.querySelectorAll('[data-battle] button')].filter((b) => { const r = b.getBoundingClientRect(); return r.height > 0 && r.height < 40; }).map((b) => `${b.textContent.trim().slice(0, 16)} ${Math.round(b.getBoundingClientRect().height)}px`);
  const choices = [...document.querySelectorAll('[aria-label="Your turn"] ol button')];
  const lastChoice = choices.length ? Math.round(choices[choices.length - 1].getBoundingClientRect().bottom - vh) : null;
  return {
    viewport: `${vw}x${vh}`, lastChoiceBelowFold: lastChoice, overflowX: document.documentElement.scrollWidth - vw, pageHeight: document.documentElement.scrollHeight,
    field: box(field), panel: box(panel), panelBelowFold: panel ? Math.max(0, Math.round(panel.getBoundingClientRect().bottom - vh)) : null,
    clipped, smallText: small, smallTargets: tooSmallTargets,
  };
};
async function battleShot(vp, name, scenario, after) {
  if (only && !name.startsWith(only)) return;
  const { ctx, page } = await open(vp, { battle: scenario });
  await page.goto(base + '/battle/b1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (after) { await after(page); await page.waitForTimeout(350); }
  const m = await page.evaluate(MEASURE_BATTLE);
  metrics[`${name}@${vp.name}`] = m;
  if (m.overflowX > 0) problems.push(`${name}@${vp.name}: horizontal overflow ${m.overflowX}px`);
  if (m.clipped.length) problems.push(`${name}@${vp.name}: ${m.clipped.slice(0, 4).join('; ')}`);
  if (m.lastChoiceBelowFold !== null && m.lastChoiceBelowFold > 0) problems.push(`${name}@${vp.name}: last answer is ${m.lastChoiceBelowFold}px below the fold`);
  if (m.smallText.length) problems.push(`${name}@${vp.name}: text under 12px: ${m.smallText.slice(0, 4).join(', ')}`);
  if (m.smallTargets.length) problems.push(`${name}@${vp.name}: tap target under 40px: ${m.smallTargets.slice(0, 4).join(', ')}`);
  await page.screenshot({ path: join(outDir, `${name}-${vp.name}.png`) });
  await page.screenshot({ path: join(outDir, `${name}-${vp.name}-full.png`), fullPage: true });
  await ctx.close();
}

for (const vp of VIEWPORTS) {
  await battleShot(vp, 'battle-intro', 'intro');
  await battleShot(vp, 'battle-move', 'move');
  await battleShot(vp, 'battle-question', 'question');
  await battleShot(vp, 'battle-feedback', 'question', async (p) => { await p.getByRole('button', { name: 'Nucleus' }).click(); await p.waitForTimeout(500); });
  await battleShot(vp, 'battle-boss', 'boss');
  await battleShot(vp, 'battle-rewards', 'ended');
}
for (const vp of VIEWPORTS) {
  if (only.startsWith('battle')) break;
  await shot(vp, 'dungeons', '/dungeons', { scenario: { dungeons: true }, measure: true });
  await shot(vp, 'dungeons-locked', '/dungeons', { scenario: { dungeons: true }, measure: true, after: async (p) => { await p.getByRole('button', { name: /The Sunken Library/ }).first().click(); await p.waitForTimeout(200); } });
}
for (const vp of VIEWPORTS) {
  if (only.startsWith('battle') || only.startsWith('dungeons')) break;
  await shot(vp, 'home', '/', { measure: true });
  await shot(vp, 'lab', '/lab', { measure: true });
  await shot(vp, 'quests', '/quests', { measure: true });
  await shot(vp, 'session-running', '/lab', { scenario: { session: runningSession() }, measure: true });
  await shot(vp, 'menu', '/quests', { after: async (p) => { await p.getByRole('button', { name: 'Menu' }).click(); await p.waitForTimeout(450); } });
}
writeFileSync(metricsFile, JSON.stringify(metrics, null, 1));
await browser.close();
await server.close();
if (problems.length) { console.log('\nProblems:\n' + problems.map((p) => ' - ' + p).join('\n')); process.exitCode = 1; }
console.log(`Screenshots: ${outDir}`);
