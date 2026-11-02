// Browser e2e of the battle screen (06 "Playwright: start a seeded battle, choose moves, answer through victory, see rewards,
// refresh at awaitingMove AND at awaitingAnswer and resume; 1280x800 and 390x844").
//   node scripts/battle-e2e.mjs        (needs PW_CHROMIUM_PATH or an installed Playwright Chromium)
// HONEST SCOPE: the API is an in-memory simulator behind Playwright routes, not the real server. It proves the real UI, in a
// real browser, drives the move -> question -> answer -> rewards flow and resumes from "server" state after a reload. The server's
// own rules are covered by apps/api/src/battles*.int.test.ts.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { API_BASE, SUPABASE_URL, STORAGE_KEY, battleFixture, fakeSession, respond } from './mock-api.mjs';

const here = dirname(fileURLToPath(import.meta.url));
process.env.VITE_SUPABASE_URL = SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fake-publishable-key';
process.env.VITE_API_BASE_URL = API_BASE;
const server = await createServer({ root: join(here, '..'), logLevel: 'error', server: { port: 5198, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });

const QUESTIONS = [
  { text: 'What is 6 x 7?', choices: ['42', '48', '36'], correct: 0 },
  { text: 'What is the square root of 81?', choices: ['7', '9', '8'], correct: 1 },
  { text: 'What is 2 to the power of 8?', choices: ['256', '128', '512'], correct: 0 },
  { text: 'What is 5 factorial?', choices: ['100', '120', '60'], correct: 1 },
];

/** A tiny in-memory stand-in for the battle endpoints: the browser's only source of truth, like the real server. */
function makeSim() {
  const s = { turn: 1, phase: 'awaitingMove', move: null, q: null, heroHp: 100, enemyHp: 60, last: null, status: 'active', calls: [], finished: 0 };
  const dto = () => battleFixture({
    turn: s.turn, phase: s.phase, status: s.status, move: s.move, lastResult: s.last,
    question: s.phase === 'awaitingAnswer' ? { text: s.q.text, choices: s.q.choices } : null,
    hero: { ...battleFixture().hero, hp: s.heroHp, maxHp: 100 },
    enemy: { ...battleFixture().enemy, hp: s.enemyHp, maxHp: 60, name: 'Goblin Chieftain', slug: 'goblin-chieftain' },
    log: [], combo: 0, focus: 0, abilities: [], intent: { key: 'strike', name: 'Strike', effect: 'A plain attack.', bossGuard: false },
  });
  const handle = (method, path, body) => {
    s.calls.push(`${method} ${path}`);
    if (method === 'GET' && path === '/battles/b1') return { battle: dto() };
    if (method === 'POST' && path === '/battles/b1/move') {
      assert.equal(body.turnNumber, s.turn);
      if (s.phase === 'awaitingMove') { s.move = body.move; s.q = QUESTIONS[(s.turn - 1) % QUESTIONS.length]; s.phase = 'awaitingAnswer'; }
      return { turnNumber: s.turn, question: { text: s.q.text, choices: s.q.choices }, battle: dto() };
    }
    if (method === 'POST' && path === '/battles/b1/answer') {
      assert.equal(s.phase, 'awaitingAnswer', 'answer before a move');
      const correct = body.selectedIndex === s.q.correct;
      const result = { turnNumber: s.turn, move: s.move, intent: 'strike', correct, selectedIndex: body.selectedIndex, correctIndex: s.q.correct, explanation: correct ? 'Well done.' : `The answer is ${s.q.choices[s.q.correct]}.`, damageDealt: correct ? 20 : 0, damageTaken: correct ? 0 : 12, enemyHealed: 0, heroHealed: 0, combo: correct ? 1 : 0, focusGained: 0, events: [], ended: false, outcome: null };
      s.enemyHp = Math.max(0, s.enemyHp - result.damageDealt);
      s.heroHp -= result.damageTaken;
      if (s.enemyHp === 0) { result.ended = true; result.outcome = 'victory'; s.status = 'victory'; s.phase = 'ended'; } else { s.turn += 1; s.phase = 'awaitingMove'; s.move = null; s.q = null; }
      s.last = result;
      return { result, battle: dto() };
    }
    if (method === 'POST' && path === '/battles/b1/finish') { s.finished += 1; return respond('POST', '/battles/b1/finish', {}); }
    return undefined;
  };
  return { s, handle };
}

const results = [];
for (const vp of [{ name: '1280x800', width: 1280, height: 800 }, { name: '390x844', width: 390, height: 844 }]) {
  const { s, handle } = makeSim();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addInitScript(([k, sess]) => { try { localStorage.setItem(k, JSON.stringify(sess)); localStorage.setItem('studyverse.sound', 'off'); } catch { /* ignore */ } }, [STORAGE_KEY, fakeSession()]);
  await ctx.route(`${API_BASE}/**`, async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    let body;
    try { body = req.postData() ? JSON.parse(req.postData()) : {}; } catch { body = {}; }
    const out = handle(req.method(), path, body) ?? respond(req.method(), path, {});
    if (out === undefined) return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"code":"NOT_FOUND","message":"No mock"}}' });
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await ctx.route(`${SUPABASE_URL}/**`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  const noSideScroll = async (where) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0, `${vp.name} ${where}: sideways scroll`);
  const step = (n) => results.push(`${vp.name}: ${n}`);

  await page.goto(`${base}/battle/b1`, { waitUntil: 'networkidle' });
  // 1. intro, then the move step, with NO question on screen yet
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('group', { name: 'Choose your move' }).waitFor();
  assert.equal(await page.getByTestId('question').count(), 0, 'a question is visible before a move was chosen');
  assert.equal(await page.getByRole('navigation').count(), 0, 'battle has navigation');
  await noSideScroll('move step'); step('intro -> move step, no question yet');

  // 2. Bold -> question; reload AT awaitingAnswer resumes the same question, no intro
  await page.getByRole('button', { name: /^Bold/ }).click();
  await page.getByTestId('question').waitFor();
  const asked = await page.getByTestId('question').textContent();
  assert.deepEqual(s.calls.filter((c) => c.includes('/move')), ['POST /battles/b1/move']);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('question').waitFor();
  assert.equal(await page.getByTestId('question').textContent(), asked, 'reload changed the question');
  assert.equal(await page.getByRole('button', { name: 'Begin' }).count(), 0, 'intro shown again after a reload');
  assert.equal(s.calls.filter((c) => c.includes('/move')).length, 1, 'reload re-rolled the move');
  await noSideScroll('question step'); step('refresh at awaitingAnswer resumes the same question');

  // 3. wrong answer -> feedback with the real answer and explanation, HP drops
  await page.getByRole('button', { name: '48', exact: true }).click();
  await page.getByText('Not quite.', { exact: true }).waitFor();
  assert.match(await page.getByTestId('explanation').textContent(), /The answer is 42/);
  assert.equal(s.heroHp, 88);
  await noSideScroll('feedback step');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('group', { name: 'Choose your move' }).waitFor();
  step('wrong answer: feedback, explanation, Continue');

  // 4. reload AT awaitingMove resumes the move step
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('group', { name: 'Choose your move' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Begin' }).count(), 0);
  assert.equal(await page.getByTestId('question').count(), 0);
  step('refresh at awaitingMove resumes the move step');

  // 5. keyboard: Enter confirms the pre-selected Steady, 2 answers (turn 2 correct = 9), then victory
  await page.keyboard.press('Enter');
  await page.getByTestId('question').waitFor();
  await page.keyboard.press('2');
  await page.getByText('Correct!', { exact: true }).waitFor();
  await page.keyboard.press('Enter'); // continue
  for (let turn = 3; s.status === 'active' && turn < 12; turn += 1) {
    await page.getByRole('group', { name: 'Choose your move' }).waitFor();
    await page.getByRole('button', { name: /^Steady/ }).click();
    await page.getByTestId('question').waitFor();
    const q = s.q;
    await page.getByRole('button', { name: q.choices[q.correct], exact: true }).click();
    await page.getByText('Correct!', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Continue|See rewards/ }).click();
  }
  assert.equal(s.status, 'victory');
  step('keyboard turn (Enter, 2, Enter) and the rest of the fight to victory');

  // 6. rewards come from the server's summary, finish is called exactly once, and the way out works
  await page.getByRole('heading', { name: 'Victory!' }).waitFor();
  assert.equal(s.finished, 1, 'finish called more than once');
  await noSideScroll('rewards'); 
  await page.getByRole('link', { name: 'Return to dungeon' }).waitFor();
  step('rewards screen from the server summary; finish called once');

  assert.deepEqual(errors, [], `${vp.name}: browser errors`);
  await ctx.close();
}
await browser.close();
await server.close();
console.log(results.join('\n'));
console.log(`\nbattle e2e: ${results.length} steps passed at 2 widths`);
