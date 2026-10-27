const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const results = []; let failed = 0;
const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  <- ' + extra}`); if (!cond) failed++; };
const SESSION = { id: 's1', status: 'running', startedAt: '', pausedAt: null, plannedSeconds: 1500, pausedTotalSec: 0, remainingSec: 780 };
const q = (o) => encodeURIComponent(JSON.stringify(o));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const open = async (query, vp = { width: 1280, height: 800 }, storage) => {
    const ctx = await browser.newContext({ viewport: vp });
    if (storage) await ctx.addInitScript((s) => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch {} }, storage);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => ok('no page error', false, e.message));
    await page.goto('file:///tmp/h/index.html?' + query);
    await page.waitForSelector('header');
    await page.waitForTimeout(150);
    return { ctx, page };
  };
  const path = (p) => p.evaluate(() => window.__path);

  // 1. hotbar structure, aria-current, accessible names with hidden badge text
  let { ctx, page } = await open('path=/quests');
  const nav = page.getByRole('navigation', { name: 'Main' });
  ok('hotbar nav "Main" exists', await nav.count() === 1);
  ok('five links + Menu button', (await nav.getByRole('link').count()) === 5 && (await nav.getByRole('button', { name: 'Menu' }).count()) === 1);
  ok('Quests has aria-current=page at /quests', (await nav.getByRole('link', { name: /^Quests/ }).getAttribute('aria-current')) === 'page');
  ok('others have no aria-current', (await nav.locator('[aria-current]').count()) === 1);
  ok('badge names: Quests', await nav.getByRole('link', { name: 'Quests, 1 quest ready to claim', exact: true }).count() === 1);
  ok('badge names: Library 12 due (visual 9+)', await nav.getByRole('link', { name: 'Library, 12 cards due', exact: true }).count() === 1 && (await nav.getByText('9+').count()) === 1);
  ok('badge names: Adventure energy pip', await nav.getByRole('link', { name: 'Adventure, 4 energy, enough for a raid', exact: true }).count() === 1);
  ok('Home and Study have no badge text', await nav.getByRole('link', { name: 'Home', exact: true }).count() === 1 && await nav.getByRole('link', { name: 'Study', exact: true }).count() === 1);
  ok('no aria-live in hotbar', (await nav.locator('[aria-live]').count()) === 0);
  await nav.getByRole('link', { name: /^Study/ }).click();
  ok('click Study -> /sessions, aria-current moves', (await path(page)) === '/sessions' && (await nav.getByRole('link', { name: /^Study/ }).getAttribute('aria-current')) === 'page' && !(await nav.getByRole('link', { name: /^Quests/ }).getAttribute('aria-current')));
  ok('tooltips show the key', (await nav.getByRole('link', { name: /^Library/ }).getAttribute('title')) === 'Library (4)');
  // colours of badges: never red
  const badgeBg = await page.locator('[data-kind]').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  ok('badge colours are gold, not red', badgeBg.length > 0 && badgeBg.every((c) => c === 'rgb(201, 164, 58)'), badgeBg.join(','));
  await ctx.close();

  // 2. quiet summary: no badges at zero; error: no badges
  ({ ctx, page } = await open('path=/&scenario=' + q({ dueCards: 0, claimableQuests: 0, energy: 2, unspentSkillPoints: 0 })));
  const names = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').allTextContents();
  ok('no badge for zero, energy below 3 shows no pip', names.join('|') === 'Home|Quests|Study|Library|Adventure', names.join('|'));
  ok('no "!" on portrait without skill points', (await page.getByRole('link', { name: 'Hero', exact: true }).count()) === 1);
  await ctx.close();
  ({ ctx, page } = await open('path=/&summary=error'));
  ok('summary error: hotbar still works, no badges', (await page.getByRole('navigation', { name: 'Main' }).getByRole('link').allTextContents()).join('|') === 'Home|Quests|Study|Library|Adventure');
  ok('summary error: no session chip', (await page.getByRole('link', { name: /Study session/ }).count()) === 0);
  await ctx.close();

  // 3. hotkeys
  ({ ctx, page } = await open('path=/quests'));
  for (const [k, p] of [['3', '/sessions'], ['4', '/lab'], ['5', '/dungeons'], ['2', '/quests'], ['1', '/'], ['h', '/camp'], ['H', '/camp']]) {
    await page.keyboard.press(k); await page.waitForTimeout(40);
    ok(`key ${k} -> ${p}`, (await path(page)) === p, await path(page));
  }
  await page.keyboard.press('Control+3'); await page.keyboard.press('Alt+4'); await page.keyboard.press('Meta+5');
  ok('Ctrl/Alt/Meta + digit ignored', (await path(page)) === '/camp');
  await page.keyboard.press('1');
  await page.locator('#last-field').focus();
  await page.keyboard.type('3m1h');
  ok('typing in a field does not trigger shortcuts', (await path(page)) === '/' && (await page.locator('#last-field').inputValue()) === '3m1h' && (await page.getByRole('dialog').count()) === 0);
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('m'); await page.waitForTimeout(60);
  ok('M opens the menu', (await page.getByRole('dialog', { name: 'Menu' }).count()) === 1);
  await page.keyboard.press('2');
  ok('digits do nothing while the menu is open', (await path(page)) === '/');
  await page.keyboard.press('Escape'); await page.waitForTimeout(60);
  ok('Escape closes', (await page.getByRole('dialog').count()) === 0);
  await ctx.close();

  // 4. menu overlay: focus in, trap, inert, Escape returns focus, toggle off, sign out, navigate
  ({ ctx, page } = await open('path=/quests'));
  const menuBtn = page.getByRole('button', { name: 'Menu' });
  ok('menu button collapsed', (await menuBtn.getAttribute('aria-expanded')) === 'false');
  await menuBtn.click(); await page.waitForTimeout(80);
  const dlg = page.getByRole('dialog', { name: 'Menu' });
  ok('dialog has aria-modal', (await dlg.getAttribute('aria-modal')) === 'true');
  ok('focus moved into the dialog', await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)));
  ok('background is inert', await page.evaluate(() => document.querySelector('header').closest('[inert]') !== null && document.querySelector('nav[aria-label=Main]').closest('[inert]') !== null));
  ok('dialog itself is not inert', await page.evaluate(() => document.querySelector('[role=dialog]').closest('[inert]') === null));
  let inside = true; for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); inside &&= await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)); }
  ok('Tab x14 never leaves the dialog', inside);
  inside = true; for (let i = 0; i < 14; i++) { await page.keyboard.press('Shift+Tab'); inside &&= await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)); }
  ok('Shift+Tab x14 never leaves the dialog', inside);
  const links = await dlg.getByRole('link').allTextContents();
  ok('menu lists Progress, Leaderboard, Settings', links.join('|') === 'Progress|Leaderboard|Settings', links.join('|'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(80);
  ok('Escape closes and focus returns to the Menu slot', (await page.getByRole('dialog').count()) === 0 && await page.evaluate(() => document.activeElement?.textContent?.startsWith('Menu')), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  ok('inert lifted after close', await page.evaluate(() => document.querySelector('[inert]') === null));
  await menuBtn.click(); await page.getByRole('button', { name: 'Close menu' }).click(); await page.waitForTimeout(80);
  ok('close button returns focus to Menu slot', await page.evaluate(() => document.activeElement?.textContent?.startsWith('Menu')));
  await menuBtn.click(); await page.mouse.click(5, 400); await page.waitForTimeout(80);
  ok('backdrop click closes', (await page.getByRole('dialog').count()) === 0);
  await menuBtn.click(); await page.getByRole('dialog').getByRole('link', { name: 'Progress' }).click(); await page.waitForTimeout(80);
  ok('following a link closes the menu and goes there', (await path(page)) === '/stats' && (await page.getByRole('dialog').count()) === 0 && await page.evaluate(() => document.activeElement?.id === 'main-content'));
  await menuBtn.click();
  const disc = page.getByRole('button', { name: 'Credits' });
  ok('credits collapsed then expands', (await disc.getAttribute('aria-expanded')) === 'false'); await disc.click();
  ok('credits text is shown', (await disc.getAttribute('aria-expanded')) === 'true' && (await page.getByText('No third-party art is used').count()) === 1);
  await page.getByRole('button', { name: 'Sign out' }).click();
  ok('Sign out calls signOut', await page.evaluate(() => window.__signedOut === true));
  await ctx.close();

  // 5. shortcut toggle persists and disables keys
  ({ ctx, page } = await open('path=/quests'));
  await page.getByRole('button', { name: 'Menu' }).click();
  const cb = page.getByRole('checkbox', { name: /Keyboard shortcuts/ });
  ok('toggle starts on', await cb.isChecked()); await cb.uncheck(); await page.keyboard.press('Escape'); await page.waitForTimeout(60);
  ok('stored as 0', (await page.evaluate(() => localStorage.getItem('studyverse.hotkeys'))) === '0');
  await page.locator('body').click({ position: { x: 5, y: 300 } }); await page.keyboard.press('3'); await page.keyboard.press('m');
  ok('with shortcuts off nothing happens', (await path(page)) === '/quests' && (await page.getByRole('dialog').count()) === 0);
  ok('tooltips drop the key when off', (await page.getByRole('link', { name: /^Library/ }).getAttribute('title')) === 'Library');
  await page.reload(); await page.waitForSelector('header'); await page.keyboard.press('3');
  ok('still off after reload (new page state)', (await path(page)) === '/quests');
  await ctx.close();
  ({ ctx, page } = await open('path=/quests', { width: 1280, height: 800 }, { 'studyverse.hotkeys': '1' }));
  await page.keyboard.press('4'); ok('stored 1 = on', (await path(page)) === '/lab'); await ctx.close();

  // 6. session chip: countdown from server value, then frozen when paused
  ({ ctx, page } = await open('path=/lab&scenario=' + q({ activeSession: SESSION })));
  const chip = page.getByRole('link', { name: /Study session running/ });
  ok('chip exists and links to /sessions', (await chip.count()) === 1 && (await chip.getAttribute('href')) === '/sessions');
  const t1 = (await chip.locator('span[aria-hidden=true]').textContent()).trim();
  await page.waitForTimeout(2300);
  const t2 = (await chip.locator('span[aria-hidden=true]').textContent()).trim();
  ok('chip counts down from the server value', t1 === '13:00' && ['12:57', '12:58'].includes(t2), `${t1} -> ${t2}`);
  ok('study slot shows the Resume pill + name', await page.getByRole('link', { name: 'Study, session in progress, resume', exact: true }).count() === 1 && (await page.getByText('Resume', { exact: true }).count()) === 1);
  await ctx.close();
  ({ ctx, page } = await open('path=/lab&scenario=' + q({ activeSession: { ...SESSION, status: 'paused', pausedAt: 'x' } })));
  const pc = page.getByRole('link', { name: /Study session paused/ });
  const p1 = (await pc.locator('span[aria-hidden=true]').textContent()).trim(); await page.waitForTimeout(1500);
  ok('paused chip says Paused and does not tick', p1 === 'Paused' && (await pc.locator('span[aria-hidden=true]').textContent()).trim() === 'Paused');
  await ctx.close();

  // 7. layout metrics at the three widths (+360)
  for (const [w, h, hudMax] of [[360, 780, 56], [390, 844, 56], [768, 1024, 64], [1280, 800, 64]]) {
    ({ ctx, page } = await open('path=/quests&scenario=' + q({ activeSession: SESSION }), { width: w, height: h }));
    const m = await page.evaluate(() => {
      const hud = document.querySelector('header').getBoundingClientRect();
      const bar = document.querySelector('nav[aria-label=Main]');
      const items = [...bar.querySelectorAll('a,button')].map((e) => e.getBoundingClientRect());
      const hb = document.querySelector('[data-hotbar]').getBoundingClientRect();
      const clipped = [...bar.querySelectorAll('[class*=label]')].filter((e) => e.scrollWidth > e.clientWidth + 1).length;
      const hudKids = [...document.querySelector('header').children].map((c) => c.getBoundingClientRect());
      let overlap = false; for (let i = 0; i < hudKids.length; i++) for (let j = i + 1; j < hudKids.length; j++) { const a = hudKids[i], b = hudKids[j]; if (a.width && b.width && a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1) overlap = true; }
      return { hudH: Math.round(hud.height), minW: Math.round(Math.min(...items.map((r) => r.width))), minH: Math.round(Math.min(...items.map((r) => r.height))), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, hbBottomGap: Math.round(innerHeight - hb.bottom), clipped, overlap, hbTop: hb.top };
    });
    ok(`${w}px: HUD height ${m.hudH} <= ${hudMax}`, m.hudH <= hudMax, JSON.stringify(m));
    ok(`${w}px: no horizontal scroll`, m.overflow <= 0, JSON.stringify(m));
    ok(`${w}px: hotbar targets >= 44px (min ${m.minW}x${m.minH})`, m.minW >= 44 && m.minH >= 44);
    ok(`${w}px: no clipped hotbar labels`, m.clipped === 0, JSON.stringify(m));
    ok(`${w}px: HUD parts do not overlap`, !m.overlap, JSON.stringify(m));
    // focused input never hidden behind the hotbar
    await page.locator('#last-field').focus(); await page.waitForTimeout(100);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(100);
    const gap = await page.evaluate(() => { const r = document.querySelector('#last-field').getBoundingClientRect(); const hb = document.querySelector('nav[aria-label=Main]').getBoundingClientRect(); return Math.round(hb.top - r.bottom); });
    ok(`${w}px: last field clear of the hotbar when scrolled to the end (gap ${gap}px)`, gap >= 0, String(gap));
    await ctx.close();
  }

  // 8. hub scene (Home)
  for (const [w, h, scale] of [[390, 844, 1], [768, 1024, 2], [1280, 800, 2]]) {
    ({ ctx, page } = await open('path=/', { width: w, height: h }));
    const stage = await page.locator('section[aria-label=Camp] > div[data-scale]');
    ok(`${w}px: hub scale is ${scale} (integer)`, (await stage.getAttribute('data-scale')) === String(scale));
    const box = await stage.boundingBox();
    ok(`${w}px: scene is ${320 * scale}x${180 * scale}`, Math.round(box.width) === 320 * scale && Math.round(box.height) === 180 * scale, JSON.stringify(box));
    const links = await page.locator('section[aria-label=Camp] a[data-prop]').evaluateAll((els) => els.map((e) => ({ n: e.getAttribute('aria-label'), r: e.getBoundingClientRect().toJSON(), href: e.getAttribute('href') })));
    ok(`${w}px: six prop links (the campfire is not one)`, links.length === 6, String(links.length));
    ok(`${w}px: every prop target >= 44x44 (min ${Math.round(Math.min(...links.map((l) => Math.min(l.r.width, l.r.height))))})`, links.every((l) => l.r.width >= 44 && l.r.height >= 44));
    ok(`${w}px: targets stay inside the scene`, links.every((l) => l.r.left >= box.x - 1 && l.r.right <= box.x + box.width + 1 && l.r.top >= box.y - 1 && l.r.bottom <= box.y + box.height + 1));
    ok(`${w}px: Dashboard heading is above the fold`, await page.evaluate(() => document.querySelector('h1').getBoundingClientRect().top < innerHeight), String(await page.evaluate(() => document.querySelector('h1').getBoundingClientRect().top)));
    ok(`${w}px: no horizontal scroll on Home`, (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
    if (w === 1280) {
      const names = links.map((l) => l.n).sort();
      ok('prop names include destination and live state', JSON.stringify(names) === JSON.stringify(['Dungeon gate, Adventure, 4 energy, enough for a raid', 'Hero tent, Hero, 2 unspent skill points', 'Journal desk, Progress', 'Library wagon, Library, 12 cards due', 'Quest board, Quests, 1 quest ready to claim', 'Study tent, Study'].sort()), JSON.stringify(names));
      ok('prop links go to the right routes', JSON.stringify(links.map((l) => l.href).sort()) === JSON.stringify(['/camp', '/dungeons', '/lab', '/quests', '/sessions', '/stats']));
      const order = await page.evaluate(() => [...document.querySelectorAll('section[aria-label=Camp] a')].map((a) => a.textContent.trim() || a.getAttribute('aria-label')).slice(0, 2));
      ok('"Skip scene" is the first link in the scene', order[0] === 'Skip scene', order.join('|'));
      await page.getByRole('link', { name: 'Skip scene' }).focus(); await page.keyboard.press('Enter');
      ok('Skip scene moves focus past the props', await page.evaluate(() => document.activeElement?.id === 'home-content'));
      await page.getByRole('link', { name: /^Library wagon/ }).click(); await page.waitForTimeout(60);
      ok('clicking a prop navigates', (await path(page)) === '/lab');
    }
    await ctx.close();
  }
  ({ ctx, page } = await open('path=/&scenario=' + q({ dueCards: 0, claimableQuests: 0, energy: 1, unspentSkillPoints: 0 })));
  const quiet = await page.locator('section[aria-label=Camp] a[data-prop]').evaluateAll((els) => els.map((e) => `${e.dataset.prop}:${e.dataset.state}`).sort());
  ok('quiet state: gate open (not ready), tents idle, board idle, wagon idle', JSON.stringify(quiet) === JSON.stringify(['gate:open', 'hero-tent:idle', 'journal-desk:idle', 'library-wagon:idle', 'quest-board:idle', 'study-tent:idle']), quiet.join(','));
  ok('quiet state: names carry no badge text', (await page.getByRole('link', { name: 'Library wagon, Library', exact: true }).count()) === 1);
  await ctx.close();
  ({ ctx, page } = await open('path=/&scenario=' + q({ activeSession: SESSION })));
  ok('active session: tent glows (state active) and name says so', (await page.locator('[data-prop=study-tent]').getAttribute('data-state')) === 'active' && (await page.getByRole('link', { name: 'Study tent, Study, session in progress, resume', exact: true }).count()) === 1);
  await ctx.close();
  ({ ctx, page } = await open('path=/&summary=error'));
  ok('summary failed: props still links, quiet states, no invented numbers', (await page.locator('section[aria-label=Camp] a[data-prop]').count()) === 6 && (await page.getByRole('link', { name: 'Library wagon, Library', exact: true }).count()) === 1);
  await ctx.close();

  // 9. travel wipe
  ({ ctx, page } = await open('path=/quests'));
  ok('no wipe on first load', (await page.getByTestId('travel-wipe').count()) === 0);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Study/ }).click(); await page.waitForTimeout(40);
  const wipe = page.getByTestId('travel-wipe');
  ok('wipe appears on a route change', (await wipe.count()) === 1);
  const info = await wipe.evaluate((e) => { const cs = getComputedStyle(e); return { pe: cs.pointerEvents, dur: cs.animationDuration, pos: cs.position, step: parseFloat(e.style.getPropertyValue('--step')) }; });
  ok('wipe ignores the pointer, lasts <= 300ms, step is a whole number of pixels', info.pe === 'none' && info.dur === '0.3s' && Number.isInteger(info.step), JSON.stringify(info));
  ok('page content is present immediately under the wipe', (await page.getByRole('heading', { name: 'Page /sessions' }).count()) === 1);
  await ctx.close();
  { const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const p2 = await c2.newPage(); await p2.goto('file:///tmp/h/index.html?path=/quests'); await p2.waitForSelector('header'); await p2.getByRole('link', { name: /^Study/ }).click(); await p2.waitForTimeout(60);
    const disp = await p2.getByTestId('travel-wipe').evaluate((e) => getComputedStyle(e).display).catch(() => 'absent');
    ok('reduced motion: the wipe is not drawn', disp === 'none' || disp === 'absent', disp);
    const anim = await p2.locator('[class*=badge]').first().evaluate((e) => getComputedStyle(e).animationName).catch(() => 'none');
    ok('reduced motion: badges do not animate', anim === 'none', anim); await c2.close(); }

  console.log(results.join('\n')); console.log(`\n${results.length - failed}/${results.length} passed`);
  await browser.close(); process.exit(failed ? 1 : 0);
})();
