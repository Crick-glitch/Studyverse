// Runs route-shots.mjs's own layout audit (horizontal overflow + targets under 40px) on the harness pages.
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const q = (o) => encodeURIComponent(JSON.stringify(o));
const SESSION = { id: 's1', status: 'running', startedAt: '', pausedAt: null, plannedSeconds: 1500, pausedTotalSec: 0, remainingSec: 780 };
const STATES = [
  ['dashboard(home hub)', 'path=/'],
  ['quests', 'path=/quests'],
  ['hud-session', 'path=/lab&scenario=' + q({ activeSession: SESSION })],
  ['hud-session-paused', 'path=/lab&scenario=' + q({ activeSession: { ...SESSION, status: 'paused', pausedAt: '2026-01-01' } })],
  ['hotbar-quiet', 'path=/&scenario=' + q({ dueCards: 0, claimableQuests: 0, energy: 0, unspentSkillPoints: 0 })],
  ['menu-open', 'path=/quests', 'menu'],
];
const VPS = [['390', 390, 844], ['768', 768, 1024], ['1280', 1280, 800]];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  let problems = 0;
  for (const [vn, w, h] of VPS) for (const [name, query, act] of STATES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
    await page.goto('file:///tmp/h/index.html?' + query); await page.waitForSelector('header'); await page.waitForTimeout(250);
    if (act === 'menu') { await page.getByRole('button', { name: 'Menu' }).click(); await page.waitForTimeout(400); }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('a[href], button, input, select, textarea')]
        .filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && s.visibility !== 'hidden' && !(el.type === 'checkbox' || el.type === 'radio') && (r.height < 40 || r.width < 40) && !el.closest('[inert]'); })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0].slice(0, 30)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
    const fixture = (x) => x.startsWith('input. ""'); const real = small.filter((x) => !fixture(x)); small.length = 0; small.push(...real);
    const bad = overflow > 0 || small.length;
    if (bad) problems++;
    console.log(`${bad ? 'FLAG' : 'ok  '} ${name}@${vn}${overflow > 0 ? ' overflow ' + overflow + 'px' : ''}${small.length ? ' small: ' + small.join('; ') : ''}`);
    await ctx.close();
  }
  console.log(problems ? `${problems} flagged` : 'nothing flagged'); await browser.close();
})();
