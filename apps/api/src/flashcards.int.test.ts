import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import type { PrismaClient } from './lib/prisma.js';
import { runSeed } from './seed/run.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import { client } from './test/http.js';
import type { TestKeys } from './test/jwt.js';

const CAPITALS: [string, string][] = [
  ['Capital of France?', 'Paris'],
  ['Capital of Italy?', 'Rome'],
  ['Capital of Spain?', 'Madrid'],
  ['Capital of Portugal?', 'Lisbon'],
  ['Capital of Germany?', 'Berlin'],
  ['Capital of Austria?', 'Vienna'],
];

describe.skipIf(!hasTestDb)('decks, cards, review and CSV (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: Express;
  let keys: TestKeys;
  let now = new Date('2026-10-23T10:00:00.000Z');
  beforeAll(async () => {
    prisma = createTestPrisma();
    await runSeed(prisma);
    ({ app, keys } = await buildTestApp(prisma, {}, () => now));
  });
  afterAll(() => prisma.$disconnect());
  const player = async () => {
    const id = await newPlayer(prisma);
    return { id, api: client(app, keys, id) };
  };
  type Api = Awaited<ReturnType<typeof player>>['api'];
  const deck = async (api: Api, name = 'Capitals') =>
    (await api.post('/decks', { name, subject: 'Other' })).body.deck.id as string;
  const addCard = (api: Api, deckId: string, q: string, a: string, distractors: string[] = []) =>
    api.post(`/decks/${deckId}/cards`, { cards: [{ question: q, answer: a, distractors }] });
  const cardsOf = async (api: Api, deckId: string) =>
    (await api.get(`/decks/${deckId}/cards`)).body.cards as {
      id: string;
      question: string;
      dueAt: string;
    }[];

  describe('the bug you reported: adding a card must keep the existing ones', () => {
    it('add 3 cards one at a time, then a 4th: all 4 are there after refetch and after a "new session"', async () => {
      const { id: userId, api } = await player();
      const d = await deck(api);
      for (const [q, a] of CAPITALS.slice(0, 3))
        expect((await addCard(api, d, q, a)).status).toBe(201);
      expect(await cardsOf(api, d)).toHaveLength(3);
      await addCard(api, d, CAPITALS[3]![0], CAPITALS[3]![1]);
      const list = await cardsOf(api, d);
      expect(list.map((c) => c.question)).toEqual(CAPITALS.slice(0, 4).map((c) => c[0]));
      // "sign out / sign in": a brand-new client for the same user id sees the same cards
      const again = client(app, keys, userId);
      expect(await cardsOf(again, d)).toHaveLength(4);
    });

    it('a batch of 10 inserts 10 rows and leaves earlier cards alone', async () => {
      const { api } = await player();
      const d = await deck(api);
      await addCard(api, d, 'first', 'one');
      const batch = Array.from({ length: 10 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` }));
      const res = await api.post(`/decks/${d}/cards`, { cards: batch });
      expect(res.body.cards).toHaveLength(10);
      expect(await cardsOf(api, d)).toHaveLength(11);
      expect(
        (await api.post(`/decks/${d}/cards`, { cards: Array.from({ length: 51 }, () => batch[0]) }))
          .status,
      ).toBe(400);
    });
  });

  it('never stores placeholder or duplicate wrong answers', async () => {
    const { api } = await player();
    const d = await deck(api);
    const res = await addCard(api, d, 'Q?', 'Right', [
      'N/A',
      'n/a',
      'right',
      'Wrong one',
      'wrong one',
    ]);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.cards[0].distractors).toEqual(['Wrong one']);
  });

  it('validates input, limits and unknown fields', async () => {
    const { api } = await player();
    const d = await deck(api);
    expect(
      (await api.post(`/decks/${d}/cards`, { cards: [{ question: '', answer: 'x' }] })).status,
    ).toBe(400);
    expect(
      (
        await api.post(`/decks/${d}/cards`, {
          cards: [{ question: 'q', answer: 'x', userId: 'z' }],
        })
      ).status,
    ).toBe(400);
    expect((await api.post('/decks', { name: '' })).status).toBe(400);
  });

  it('edit, move between decks, delete; deleting a deck deletes its cards', async () => {
    const { api } = await player();
    const a = await deck(api, 'A');
    const b = await deck(api, 'B');
    const [card] = (await addCard(api, a, 'old?', 'old')).body.cards;
    expect(
      (await api.patch(`/cards/${card.id}`, { question: 'new?', answer: 'new', deckId: b })).body
        .card,
    ).toMatchObject({ question: 'new?', answer: 'new', deckId: b });
    expect(await cardsOf(api, a)).toHaveLength(0);
    expect(await cardsOf(api, b)).toHaveLength(1);
    expect((await api.del(`/decks/${b}`)).status).toBe(204);
    expect((await api.get(`/decks/${b}/cards`)).status).toBe(404);
    expect((await api.patch(`/cards/${card.id}`, { question: 'x' })).status).toBe(404);
  });

  it('another player cannot read, edit, delete, review or import into your deck or cards', async () => {
    const alice = await player();
    const bob = await player();
    const d = await deck(alice.api);
    const [card] = (await addCard(alice.api, d, 'Q?', 'A')).body.cards;
    const checks = await Promise.all([
      bob.api.get(`/decks/${d}/cards`),
      bob.api.post(`/decks/${d}/cards`, { cards: [{ question: 'q', answer: 'a' }] }),
      bob.api.patch(`/decks/${d}`, { name: 'mine now' }),
      bob.api.del(`/decks/${d}`),
      bob.api.patch(`/cards/${card.id}`, { question: 'hax' }),
      bob.api.del(`/cards/${card.id}`),
      bob.api.post(`/cards/${card.id}/review`, {
        mode: 'rate',
        rating: 'good',
        dueAtSeen: card.dueAt,
      }),
      bob.api.post(`/decks/${d}/csv/import`, { csv: 'question,correct\nq,a' }),
      bob.api.get(`/decks/${d}/csv`),
      bob.api.get(`/flashcards/due?deckId=${d}`),
    ]);
    expect(checks.map((r) => r.status)).toEqual(Array(checks.length).fill(404));
    expect(await cardsOf(alice.api, d)).toHaveLength(1);
    expect((await bob.api.get('/decks')).body.decks).toHaveLength(0);
    // moving a card into someone else's deck is refused too
    const own = await deck(bob.api);
    const [mine] = (await addCard(bob.api, own, 'm?', 'm')).body.cards;
    expect((await bob.api.patch(`/cards/${mine.id}`, { deckId: d })).status).toBe(404);
  });

  describe('review', () => {
    async function fullDeck(api: Api) {
      const d = await deck(api);
      await api.post(`/decks/${d}/cards`, {
        cards: CAPITALS.map(([question, answer]) => ({ question, answer })),
      });
      return d;
    }

    it('serves due cards as 3-choice questions WITHOUT the answer; cards that cannot form choices are "reveal"', async () => {
      const { api } = await player();
      const d = await fullDeck(api);
      const queue = (await api.get(`/flashcards/due?deckId=${d}`)).body;
      expect(queue.dueTotal).toBe(6);
      for (const item of queue.items) {
        expect(item.mode).toBe('choice');
        expect(item.choices).toHaveLength(3);
        expect(item).not.toHaveProperty('answer');
        expect(item.choices.every((c: string) => c.trim() !== '' && !/^n\/?a$/i.test(c))).toBe(
          true,
        );
      }
      const lone = await deck(api, 'lone');
      await addCard(api, lone, 'Only card in an odd subject?', 'zzz');
      const loneQueue = (await api.get(`/flashcards/due?deckId=${lone}`)).body.items;
      // the other decks' answers can be borrowed (same subject "Other"), so it is still a choice card...
      expect(loneQueue[0].mode).toBe('choice');
      // ...but a card with no possible wrong answers anywhere is reveal-only
      const solo = await player();
      const sd = await deck(solo.api);
      await addCard(solo.api, sd, 'Solo?', 'yes');
      const soloItem = (await solo.api.get('/flashcards/due')).body.items[0];
      expect(soloItem).toMatchObject({ mode: 'reveal', answer: 'yes' });
    });

    it('a correct choice schedules the card, records one review, and advances the daily quest once', async () => {
      const { id: userId, api } = await player();
      const d = await fullDeck(api);
      const item = (await api.get(`/flashcards/due?deckId=${d}&limit=1`)).body.items[0];
      const card = await prisma.flashcard.findUniqueOrThrow({ where: { id: item.id } });
      const send = () =>
        api.post(`/cards/${item.id}/review`, {
          mode: 'choice',
          chosenAnswer: card.answer,
          dueAtSeen: item.dueAt,
        });
      const first = await send();
      expect(first.body).toMatchObject({
        applied: true,
        correct: true,
        correctAnswer: card.answer,
        intervalDays: 1,
      });
      expect(new Date(first.body.card.dueAt).getTime()).toBe(now.getTime() + 86_400_000);
      // double click / retry / second tab with the SAME dueAtSeen: nothing applies twice
      const second = await send();
      expect(second.body.applied).toBe(false);
      expect(await prisma.flashcardReview.count({ where: { cardId: item.id } })).toBe(1);
      const quest = await prisma.playerQuest.findFirst({
        where: { userId, quest: { slug: 'daily-review-cards' } },
      });
      expect(quest?.progress).toBe(1);
      // the card is no longer in the queue
      expect((await api.get(`/flashcards/due?deckId=${d}`)).body.dueTotal).toBe(5);
    });

    it('concurrent identical reviews apply exactly once', async () => {
      const { api } = await player();
      const d = await fullDeck(api);
      const item = (await api.get(`/flashcards/due?deckId=${d}&limit=1`)).body.items[0];
      const res = await Promise.all(
        Array.from({ length: 5 }, () =>
          api.post(`/cards/${item.id}/review`, {
            mode: 'choice',
            chosenAnswer: 'whatever',
            dueAtSeen: item.dueAt,
          }),
        ),
      );
      expect(res.filter((r) => r.body.applied)).toHaveLength(1);
      expect(await prisma.flashcardReview.count({ where: { cardId: item.id } })).toBe(1);
    });

    it('a wrong choice resets the interval, lowers ease, reveals the answer', async () => {
      const { api } = await player();
      const d = await fullDeck(api);
      const item = (await api.get(`/flashcards/due?deckId=${d}&limit=1`)).body.items[0];
      const res = await api.post(`/cards/${item.id}/review`, {
        mode: 'choice',
        chosenAnswer: 'definitely wrong',
        dueAtSeen: item.dueAt,
      });
      expect(res.body).toMatchObject({ applied: true, correct: false, intervalDays: 1 });
      expect(res.body.correctAnswer).toBeTruthy();
      expect(res.body.card.ease).toBeLessThan(2.5);
    });

    it('rate mode maps again/hard/good/easy; reps 1 -> 1 day, 2 -> 6 days', async () => {
      const { api } = await player();
      const d = await deck(api);
      const [c] = (await addCard(api, d, 'Q?', 'A')).body.cards;
      const r1 = await api.post(`/cards/${c.id}/review`, {
        mode: 'rate',
        rating: 'good',
        dueAtSeen: c.dueAt,
      });
      expect(r1.body).toMatchObject({ applied: true, intervalDays: 1 });
      now = new Date(now.getTime() + 86_400_000);
      const r2 = await api.post(`/cards/${c.id}/review`, {
        mode: 'rate',
        rating: 'easy',
        dueAtSeen: r1.body.card.dueAt,
      });
      expect(r2.body.intervalDays).toBe(6);
      expect(
        (
          await api.post(`/cards/${c.id}/review`, {
            mode: 'rate',
            rating: 'legendary',
            dueAtSeen: r2.body.card.dueAt,
          })
        ).status,
      ).toBe(400);
    });

    it('a card that is not due yet cannot be reviewed (no farming the daily quest)', async () => {
      const { api } = await player();
      const d = await deck(api);
      const [c] = (await addCard(api, d, 'Q?', 'A')).body.cards;
      const r1 = await api.post(`/cards/${c.id}/review`, {
        mode: 'rate',
        rating: 'good',
        dueAtSeen: c.dueAt,
      });
      const early = await api.post(`/cards/${c.id}/review`, {
        mode: 'rate',
        rating: 'good',
        dueAtSeen: r1.body.card.dueAt,
      });
      expect(early.status).toBe(409);
      expect(early.body.error.code).toBe('CARD_NOT_DUE');
    });
  });

  describe('CSV', () => {
    const header = 'question,correct,wrong1,wrong2,subject,difficulty';
    it('preview writes nothing; import adds valid rows, reports bad ones by row, skips duplicates', async () => {
      const { api } = await player();
      const d = await deck(api);
      await addCard(api, d, 'Already here?', 'yes');
      const csv = [
        header,
        'What is 2+2?,4,3,5,Math,easy',
        'Already here?,yes,,,,',
        ',missing question,,,,',
        'Missing answer?,,x,y,,',
        'Bad difficulty?,a,b,c,Math,extreme',
        '"Comma, and ""quotes""?",ok,"n,o",N/A,Language,hard',
        'what is 2+2?,4,,,,', // duplicate inside the file (case-insensitive)
      ].join('\n');
      const preview = (await api.post(`/decks/${d}/csv/preview`, { csv })).body;
      expect(preview).toMatchObject({ totalRows: 7, valid: 2, duplicates: 2, fatal: null });
      expect(preview.errors.map((e: { row: number }) => e.row)).toEqual([4, 5, 6]);
      expect(preview.errors[0].message).toBe('missing question');
      expect(await cardsOf(api, d)).toHaveLength(1); // preview wrote nothing
      const done = (await api.post(`/decks/${d}/csv/import`, { csv })).body;
      expect(done.imported).toBe(2);
      const cards = await prisma.flashcard.findMany({
        where: { deckId: d },
        orderBy: { createdAt: 'asc' },
      });
      expect(cards).toHaveLength(3);
      const tricky = cards.find((c) => c.question.startsWith('Comma'))!;
      expect(tricky.question).toBe('Comma, and "quotes"?');
      expect(tricky.distractors).toEqual(['n,o']); // "N/A" dropped
      expect(tricky.subject).toBe('Language');
      // importing the same file again adds nothing
      expect((await api.post(`/decks/${d}/csv/import`, { csv })).body.imported).toBe(0);
      expect(await cardsOf(api, d)).toHaveLength(3);
    });

    it('accepts the OLD export header (no difficulty column)', async () => {
      const { api } = await player();
      const d = await deck(api);
      const csv =
        'question,correct,wrong1,wrong2,subject,ease,interval,repetitions,nextReview\nQ1?,A1,W1,W2,Math,2.5,6,2,2027-01-01T00:00:00.000Z';
      const res = (await api.post(`/decks/${d}/csv/import`, { csv })).body;
      expect(res.imported).toBe(1);
      const c = await prisma.flashcard.findFirstOrThrow({ where: { deckId: d } });
      expect(c).toMatchObject({ intervalDays: 6, repetitions: 2, difficulty: 'medium' });
    });

    it('fatal problems import nothing: no header, empty, too many rows', async () => {
      const { api } = await player();
      const d = await deck(api);
      expect(
        (await api.post(`/decks/${d}/csv/import`, { csv: 'foo,bar\n1,2' })).body,
      ).toMatchObject({ imported: 0, fatal: expect.stringContaining('header') });
      const many =
        'question,correct\n' + Array.from({ length: 1001 }, (_, i) => `q${i},a`).join('\n');
      expect((await api.post(`/decks/${d}/csv/import`, { csv: many })).body.fatal).toMatch(
        /Too many rows/,
      );
      expect(await cardsOf(api, d)).toHaveLength(0);
    });

    it('export then import round-trips; formulas are neutralised in the file and restored on import; review data is opt-in', async () => {
      const { api } = await player();
      const d = await deck(api, 'Round trip');
      await api.post(`/decks/${d}/cards`, {
        cards: [
          {
            question: 'Plain?',
            answer: 'Yes',
            distractors: ['No', 'Maybe'],
            subject: 'Math',
            difficulty: 'hard',
          },
          { question: '=HYPERLINK("http://evil","click")', answer: '+1', distractors: [] },
        ],
      });
      const plain = await api.get(`/decks/${d}/csv`);
      expect(plain.headers['content-type']).toMatch(/text\/csv/);
      expect(plain.headers['content-disposition']).toMatch(
        /attachment; filename="studyverse-flashcards-Round-trip\.csv"/,
      );
      expect(plain.text.split(/\r?\n/)[0]).toBe(header);
      expect(plain.text).not.toMatch(/ease/);
      expect(plain.text).not.toMatch(/(^|,|\n)=HYPERLINK/); // neutralised, never a live formula
      expect(
        (await api.get(`/decks/${d}/csv?includeReview=true`)).text.split(/\r?\n/)[0],
      ).toContain('nextReview');
      const d2 = await deck(api, 'Copy');
      const res = (await api.post(`/decks/${d2}/csv/import`, { csv: plain.text })).body;
      expect(res.imported).toBe(2);
      const copy = await prisma.flashcard.findMany({
        where: { deckId: d2 },
        orderBy: { createdAt: 'asc' },
      });
      expect(copy.map((c) => c.question).sort()).toEqual([
        '=HYPERLINK("http://evil","click")',
        'Plain?',
      ]);
      const plainCard = copy.find((c) => c.question === 'Plain?')!;
      expect(plainCard).toMatchObject({ answer: 'Yes', subject: 'Math', difficulty: 'hard' });
      expect(plainCard.distractors).toEqual(['No', 'Maybe']);
    });

    it('the CSV routes accept bodies bigger than the 100 KB default; other routes do not', async () => {
      const { id, api } = await player();
      const d = await deck(api);
      const csv =
        'question,correct\n' +
        Array.from({ length: 900 }, (_, i) => `${'x'.repeat(130)} ${i},a`).join('\n');
      expect(csv.length).toBeGreaterThan(100_000);
      expect((await api.post(`/decks/${d}/csv/import`, { csv })).status).toBe(200);
      const huge = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${await keys.sign({ sub: id })}`)
        .send({ title: 'x'.repeat(200_000) });
      expect(huge.status).toBe(413);
    });
  });
});
