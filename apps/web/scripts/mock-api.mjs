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
    if (p === '/import/local/preflight') return { hasProgress: false, existing: { totalXp: 0, tasks: 0, sessions: 0, flashcards: 0 } };
  }
  return undefined;
}

export const runningSession = () => session();
export const finishedSession = () => session({ status: 'finished', remainingSec: 0, elapsedSec: 1500 });
