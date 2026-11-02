const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const out = process.argv[2] || '/tmp/h/shots'; fs.mkdirSync(out, { recursive: true });
  const errors = [];
  const run = async (name, vp, query, after) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: pageerror ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: console ${m.text()}`); });
    await page.goto('file:///tmp/h/index.html?' + query);
    await page.waitForTimeout(400);
    if (after) await after(page);
    await page.screenshot({ path: `${out}/${name}.png` });
    await ctx.close();
  };
  const VPS = { 390: { width: 390, height: 844 }, 768: { width: 768, height: 1024 }, 1280: { width: 1280, height: 800 } };
  for (const [k, vp] of Object.entries(VPS)) {
    await run(`default-${k}`, vp, 'path=/quests');
    await run(`home-${k}`, vp, 'path=/');
    await run(`session-${k}`, vp, 'path=/lab&scenario=' + encodeURIComponent(JSON.stringify({ activeSession: { id: 's1', status: 'running', startedAt: '', pausedAt: null, plannedSeconds: 1500, pausedTotalSec: 0, remainingSec: 780 } })));
    await run(`quiet-${k}`, vp, 'path=/&scenario=' + encodeURIComponent(JSON.stringify({ dueCards: 0, claimableQuests: 0, energy: 0, unspentSkillPoints: 0 })));
    await run(`menu-${k}`, vp, 'path=/quests', async (p) => { await p.getByRole('button', { name: 'Menu' }).click(); await p.waitForTimeout(400); });
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors');
  await browser.close();
})();
