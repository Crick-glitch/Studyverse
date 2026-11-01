// Fake StudyVerse API + Supabase session for screenshots and layout checks. Development tool only: nothing here ships.
// Data is made up for the pictures; the real API is never contacted.

const NOW = new Date('2026-10-26T10:00:00Z');
const iso = (offsetHours = 0) => new Date(NOW.getTime() + offsetHours * 3600_000).toISOString();

export const SUPABASE_URL = 'http://127.0.0.1:54321';
export const API_BASE = 'http://localhost:4000/api/v1';
// supabase-js stores the session under sb-<first label of the host>-auth-token
export const STORAGE_KEY = 'sb-127-auth-token';

export function fakeSession() {
  const exp = Math.floor(NOW.getTime() / 1000) + 10 * 365 * 24 * 3600;
  return {
    access_token: 'fake.access.token',
    refresh_token: 'fake-refresh',
    token_type: 'bearer',
    expires_in: 315360000,
    expires_at: exp,
    user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'ada@example.com', app_metadata: {}, user_metadata: {}, created_at: iso(-999) },
  };
}

const me = {
  user: { id: 'u1', email: 'ada@example.com' },
  profile: { id: 'u1', displayName: 'Ada Lovelace', avatarKey: null, avatarUrl: null, playerClass: null, showOnLeaderboard: false, createdAt: iso(-500) },
  progress: { level: 4, totalXp: 610, currentLevelXp: 160, xpForNextLevel: 200, streak: 5, studyEnergy: 4, skillPoints: 2, raidWins: 0, raidLosses: 0 },
};

const task = (id, title, difficulty, subject, status = 'open') => ({
  id, title, difficulty, subject, status, rewardXp: { easy: 10, medium: 25, hard: 50 }[difficulty], rewarded: status === 'completed',
  completedAt: status === 'completed' ? iso(-3) : null, createdAt: iso(-30),
});
const tasks = [
  task('t1', 'Finish chapter 4 problem set', 'hard', 'Math'),
  task('t2', 'Read the Treaty of Versailles summary', 'medium', 'History'),
  task('t3', 'Label the parts of a cell', 'easy', 'Biology'),
  task('t4', 'Write the lab report intro', 'medium', 'Science', 'completed'),
];

const quest = (id, period, title, description, target, progress, rewardXp, rewardEnergy, claimed = false) => ({
  id, slug: id, period, periodKey: '2026-10-26', title, description, metric: 'sessions_claimed', target, progress,
  rewardXp, rewardEnergy, claimable: !claimed && progress >= target, claimed, resetsAt: iso(14),
});
const quests = [
  quest('q1', 'daily', 'Finish a study session', 'Complete and claim one study session.', 1, 1, 30, 1),
  quest('q2', 'daily', 'Review 10 flashcards', 'Answer ten due flashcards in the Lab.', 10, 6, 30, 0),
  quest('q3', 'daily', 'Complete 2 tasks', 'Finish two personal tasks.', 2, 2, 30, 0, true),
  quest('q4', 'weekly', 'Study for 150 minutes', 'Claim sessions worth 150 minutes this week.', 150, 85, 100, 0),
];

const session = (over = {}) => ({
  id: 's1', title: 'Calculus practice', subject: 'Math', difficulty: 'medium', kind: 'study', plannedMinutes: 25, status: 'running',
  startedAt: iso(-0.2), pausedAt: null, finishedAt: null, elapsedSec: 720, remainingSec: 780, serverNow: iso(0), focusRatioReported: null,
  xpAwarded: 0, energyAwarded: 0, outcomeReason: null, estimate: { xp: 25, energy: 2 }, createdAt: iso(-0.3), ...over,
});
const history = [
  session({ id: 'h1', title: 'History reading', subject: 'History', difficulty: 'hard', plannedMinutes: 50, status: 'claimed', finishedAt: iso(-26), xpAwarded: 75, energyAwarded: 5 }),
  session({ id: 'h2', title: 'Biology flashcards', subject: 'Flashcards', difficulty: 'easy', kind: 'review', plannedMinutes: 10, status: 'claimed', finishedAt: iso(-50), xpAwarded: 8, energyAwarded: 1 }),
  session({ id: 'h3', title: 'Quick math drill', subject: 'Math', plannedMinutes: 10, status: 'abandoned', finishedAt: iso(-72), outcomeReason: 'not_enough_time' }),
];

const decks = [
  { id: 'd1', name: 'Cell biology', subject: 'Biology', cardCount: 24, dueCount: 6, createdAt: iso(-300) },
  { id: 'd2', name: 'Calculus rules', subject: 'Math', cardCount: 12, dueCount: 0, createdAt: iso(-200) },
];
const cards = [
  { id: 'c1', deckId: 'd1', question: 'What does the mitochondrion do?', answer: 'Makes ATP for the cell', distractors: ['Stores DNA', 'Builds proteins'], subject: 'Biology', difficulty: 'easy', ease: 2.5, intervalDays: 3, repetitions: 2, dueAt: iso(-1) },
  { id: 'c2', deckId: 'd1', question: 'Which organelle packages proteins for export?', answer: 'Golgi apparatus', distractors: [], subject: 'Biology', difficulty: 'medium', ease: 2.3, intervalDays: 1, repetitions: 1, dueAt: iso(20) },
];
const reviewItems = [
  { id: 'c1', deckId: 'd1', question: 'What does the mitochondrion do?', subject: 'Biology', dueAt: iso(-1), mode: 'choice', choices: ['Stores DNA', 'Makes ATP for the cell', 'Builds proteins'] },
];

const claimQuestions = [
  { position: 0, text: 'What is the derivative of x squared?', choices: ['2x', 'x', 'x squared over 2'] },
  { position: 1, text: 'What is the limit of 1/x as x grows without bound?', choices: ['0', '1', 'It does not exist'] },
];

/** The counts behind the hotbar badges. A running session in the scenario shows up as the HUD chip. */
function summary(scenario) {
  const s = scenario.session && ['running', 'paused'].includes(scenario.session.status) ? scenario.session : null;
  return {
    dueCards: 12, claimableQuests: 1, energy: 4, unspentSkillPoints: 2, serverNow: iso(0),
    activeSession: s && {
      id: s.id, status: s.status, startedAt: s.startedAt, pausedAt: s.pausedAt, plannedSeconds: s.plannedMinutes * 60,
      pausedTotalSec: 0, remainingSec: s.remainingSec,
    },
    ...scenario.summary,
  };
}

// ---- battle fixtures (screenshots only) ----
const heroOf = (over = {}) => ({
  hp: 82, maxHp: 100, atk: 13, def: 6, level: 4, playerClass: 'scholar',
  weapon: { slug: 'scribes-staff', name: "Scribe's Staff", rarity: 'uncommon', effect: '+1 Focus on your first correct answer each battle.' },
  armor: { slug: 'scholars-robe', name: "Scholar's Robe", rarity: 'uncommon', effect: '+10% battle XP.' },
  perks: ['Scholar: +15% XP, +1 energy on victory'], ...over,
});
const intentOf = (key = 'strike') => ({
  strike: { key: 'strike', name: 'Strike', effect: 'A plain attack.', bossGuard: false },
  heavy: { key: 'heavy', name: 'Heavy Strike', effect: 'A wrong answer hurts 60% more.', bossGuard: false },
  guard: { key: 'guard', name: 'Guard', effect: 'Your damage is halved unless you break the guard with a hard question.', bossGuard: false },
}[key]);
const lastResult = { turnNumber: 2, move: 'steady', intent: 'strike', correct: true, selectedIndex: 1, correctIndex: 1, explanation: null, damageDealt: 17, damageTaken: 0, enemyHealed: 0, heroHealed: 0, combo: 2, focusGained: 1, events: [], ended: false, outcome: null };
export const battleFixture = (over = {}) => ({
  id: 'b1', mode: 'raid', status: 'active', phase: 'awaitingMove', subject: 'Math', tier: 1,
  dungeon: { slug: 'archive', name: 'The Whispering Archive', background: 'dungeon.archive' }, turn: 3,
  hero: heroOf(),
  enemy: { slug: 'gearwork-golem', name: 'Gearwork Golem', isBoss: false, bossPhase: 1, intro: null, hp: 41, maxHp: 108, atk: 13, def: 8 },
  combo: 2, focus: 2, focusMax: 3, intent: intentOf('heavy'), move: null, question: null, removedIndex: null, armed: null,
  abilities: [{ key: 'insight', label: 'Insight', effect: 'Removes one wrong choice from this question.', cost: 3, available: false, reason: 'Needs 3 Focus (you have 2).', armed: false }],
  questionsAsked: 2, correctAnswers: 2, lastResult, log: ['Battle started!', 'Correct! You deal 12 damage.', 'Correct! You deal 17 damage. Combo 2!'],
  startedAt: iso(-0.1), endedAt: null, ...over,
});
const QUESTION = { text: 'Which organelle is the powerhouse of the cell, making most of the ATP a cell needs?', choices: ['Nucleus', 'Mitochondria', 'Ribosome'] };
export const battleScenarios = {
  intro: () => battleFixture({ turn: 1, lastResult: null, questionsAsked: 0, correctAnswers: 0, combo: 0, focus: 0, log: ['Battle started!'], intent: intentOf('strike'), enemy: { slug: 'goblin-chieftain', name: 'Goblin Chieftain', isBoss: false, bossPhase: 1, intro: null, hp: 72, maxHp: 72, atk: 9, def: 3 }, hero: heroOf({ hp: 100 }) }),
  move: () => battleFixture(),
  question: () => battleFixture({ phase: 'awaitingAnswer', move: 'bold', question: QUESTION, focus: 3, abilities: [{ key: 'insight', label: 'Insight', effect: 'Removes one wrong choice from this question.', cost: 3, available: true, reason: null, armed: false }] }),
  boss: () => battleFixture({
    phase: 'awaitingAnswer', move: 'steady', question: { text: 'What is the derivative of f(x) = x cubed minus 4x?', choices: ['3x squared minus 4', '3x squared minus 4x', 'x squared minus 4'] },
    dungeon: { slug: 'archive', name: 'The Whispering Archive', background: 'dungeon.archive' },
    enemy: { slug: 'procrastination-wyrm', name: 'The Procrastination Wyrm', isBoss: true, bossPhase: 2, intro: 'Later, it hisses. Always later.', hp: 96, maxHp: 242, atk: 17, def: 7 },
    intent: intentOf('guard'), hero: heroOf({ hp: 64, level: 6 }),
  }),
  ended: () => battleFixture({ phase: 'ended', status: 'victory', enemy: { slug: 'gearwork-golem', name: 'Gearwork Golem', isBoss: false, bossPhase: 1, intro: null, hp: 0, maxHp: 108, atk: 13, def: 8 } }),
};
const answerResponse = () => ({
  result: { turnNumber: 3, move: 'bold', intent: 'heavy', correct: false, selectedIndex: 0, correctIndex: 1, explanation: 'Mitochondria produce most of the cell\'s ATP through cellular respiration, which is why they are called its powerhouse.', damageDealt: 0, damageTaken: 14, enemyHealed: 0, heroHealed: 0, combo: 0, focusGained: 0, events: [{ type: 'hit', text: 'Gearwork Golem hits you for 14.' }], ended: false, outcome: null },
  battle: battleFixture({ turn: 4, hero: heroOf({ hp: 68 }), combo: 0, lastResult: null }),
});
const rewardSummary = () => ({
  battleId: 'b1', mode: 'raid', outcome: 'victory', subject: 'Math', tier: 1, enemy: { slug: 'gearwork-golem', name: 'Gearwork Golem', isBoss: false },
  asked: 7, correct: 5, xp: { requested: 31, awarded: 31, capped: false, dailyCap: null }, energy: 2,
  loot: { slug: 'quillblade', name: 'Quillblade', slot: 'weapon', rarity: 'rare', atk: 6, def: 0, effect: 'hard_damage_20', equipped: false, duplicate: false, duplicateXp: 0 },
  firstClear: null, levelsGained: 1,
  missed: [
    { turnNumber: 2, subject: 'Math', text: 'What is the derivative of f(x) = x cubed minus 4x?', choices: ['3x squared minus 4', '3x squared minus 4x', 'x squared minus 4'], correctIndex: 0, selectedIndex: 1, explanation: null, isCard: false },
    { turnNumber: 5, subject: 'Math', text: 'What is the sum of the infinite series 1 + 1/2 + 1/4 + ...?', choices: ['2', '3', '1.5'], correctIndex: 0, selectedIndex: 2, explanation: 'A geometric series with ratio one half sums to 1 divided by (1 minus 1/2), which is 2.', isCard: false },
  ],
  weakSpot: { subject: 'Math', missed: 2 },
  progress: { level: 5, totalXp: 641, currentLevelXp: 12, xpForNextLevel: 250, streak: 5, studyEnergy: 6, skillPoints: 3, raidWins: 1, raidLosses: 0 }, alreadyFinished: false,
});

/** scenario: { session?: SessionDto|null, summary?: Partial<SummaryDto>, importPrompt?: bool } */
export function respond(method, pathname, scenario = {}) {
  const p = pathname.replace(/^\/api\/v1/, '');
  if (method === 'GET') {
    if (p === '/me') return me;
    if (p === '/summary') return summary(scenario);
    if (p === '/tasks') return { tasks };
    if (p === '/quests') return { quests };
    if (p === '/sessions/active') return { session: scenario.session ?? null, serverNow: iso(0) };
    if (p === '/sessions') return { sessions: history };
    if (p === '/decks') return { decks };
    if (/^\/decks\/[^/]+\/cards$/.test(p)) return { cards };
    if (p === '/flashcards/due') return { items: reviewItems, dueTotal: 6, serverNow: iso(0) };
    if (/^\/sessions\/[^/]+\/claim$/.test(p)) return { session: session({ status: 'finished' }), questions: claimQuestions };
    if (p === '/battles/active') return { battle: null };
    if (p === '/battles/b1' && scenario.battle) return { battle: battleScenarios[scenario.battle]() };
    if (p === '/import/local/preflight') return { hasProgress: false, existing: { totalXp: 0, tasks: 0, sessions: 0, flashcards: 0 } };
  }
  if (method === 'POST') {
    if (p === '/battles/b1/answer') return answerResponse();
    if (p === '/battles/b1/finish') return { summary: rewardSummary() };
  }
  return undefined;
}

export const runningSession = () => session();
export const finishedSession = () => session({ status: 'finished', remainingSec: 0, elapsedSec: 1500 });
