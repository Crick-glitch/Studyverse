// Screenshots of every route at 390 / 768 / 1280 px against a mocked API, plus layout checks.
//   npm run shots -w apps/web              -> writes PNGs to docs/screens/
//   ONLY=lab npm run shots -w apps/web     -> only screens whose name starts with "lab"
// Needs a Chromium that Playwright can launch. If `npx playwright install chromium` has been run, nothing else is needed;
// otherwise set PW_CHROMIUM_PATH to a Chromium/Chrome binary.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { API_BASE, SUPABASE_URL, STORAGE_KEY, fakeSession, finishedSession, respond, runningSession } from './mock-api.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const outDir = process.argv[2] ?? join(webRoot, '..', '..', 'docs', 'screens');
mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
];

process.env.VITE_SUPABASE_URL = SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fake-publishable-key';
process.env.VITE_API_BASE_URL = API_BASE;

const server = await createServer({ root: webRoot, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});

const problems = [];

async function open(vp, { signedIn = true, scenario = {}, legacy = false, collapsed } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(
    ([key, session, signed, legacySave, coll]) => {
      try {
        if (signed) localStorage.setItem(key, JSON.stringify(session));
        if (legacySave) localStorage.setItem('studyverse-data', JSON.stringify({ level: 3, totalXP: 400, tasks: [], flashcards: [], sessions: [] }));
        if (coll === true || coll === false) localStorage.setItem('studyverse.sidebar-collapsed', coll ? '1' : '0'); // undefined arrives as null
      } catch { /* ignore */ }
    },
    [STORAGE_KEY, fakeSession(), signedIn, legacy, collapsed],
  );
  await ctx.route(`${API_BASE}/**`, async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = respond(req.method(), new URL(req.url()).pathname, scenario);
    if (body === undefined) return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No mock for this call' } }) });
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route(`${SUPABASE_URL}/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`); });
  return { ctx, page };
}

async function shot(vp, name, path, opts = {}, after) {
  if (process.env.ONLY && !name.startsWith(process.env.ONLY)) return; // e.g. ONLY=lab npm run shots
  const { ctx, page } = await open(vp, opts);
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  if (after) await after(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) {
    const culprits = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > w + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[inert]') === !el.closest('[inert]'))
        .slice(0, 4)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0].slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)}`);
    });
    problems.push(`${name}@${vp.name}: horizontal overflow of ${overflow}px (${culprits.join('; ')})`);
  }
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('a[href], button, input, select, textarea')]
      .filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && s.visibility !== 'hidden' && !(el.type === 'checkbox' || el.type === 'radio') && (r.height < 40 || r.width < 40) && !el.closest('[inert]'); })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
  );
  if (small.length) problems.push(`${name}@${vp.name}: targets under 40px: ${small.slice(0, 4).join('; ')}`);
  await page.screenshot({ path: join(outDir, `${name}-${vp.name}.png`), fullPage: false });
  await ctx.close();
}

for (const vp of VIEWPORTS) {
  await shot(vp, 'login', '/login', { signedIn: false });
  await shot(vp, 'dashboard', '/');
  await shot(vp, 'quests-tasks', '/quests');
  await shot(vp, 'quests-adventure', '/quests', {}, async (p) => { await p.getByRole('tab', { name: 'Adventure Quests' }).click(); await p.waitForTimeout(150); });
  await shot(vp, 'sessions-plan', '/sessions');
  await shot(vp, 'sessions-active', '/sessions', { scenario: { session: runningSession() } });
  await shot(vp, 'sessions-claim', '/sessions', { scenario: { session: finishedSession() } });
  await shot(vp, 'lab', '/lab');
  await shot(vp, 'lab-deck', '/lab?deck=d1');
  await shot(vp, 'lab-review', '/lab?review=all');
  await shot(vp, 'import-dialog', '/', { legacy: true });
  for (const [name, path] of [['camp', '/camp'], ['dungeons', '/dungeons'], ['stats', '/stats'], ['leaderboard', '/leaderboard'], ['settings', '/settings'], ['battle', '/battle/abc'], ['not-found', '/nope']]) {
    await shot(vp, name, path);
  }
}
// navigation states
await shot(VIEWPORTS[2], 'sidebar-collapsed', '/quests', { collapsed: true });
await shot(VIEWPORTS[0], 'drawer-open', '/quests', {}, async (p) => { await p.getByRole('button', { name: 'Open menu' }).click(); await p.waitForTimeout(400); });

await browser.close();
await server.close();
if (problems.length) {
  console.log('\nLayout/console problems:\n' + problems.map((x) => ' - ' + x).join('\n'));
  process.exitCode = 1;
} else console.log('\nNo horizontal overflow, console errors or undersized targets found.');
console.log(`Screenshots: ${outDir}`);
