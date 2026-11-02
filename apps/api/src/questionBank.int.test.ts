import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from './lib/prisma.js';
import {
  analyzeQuestions,
  findQuestionBankFile,
  loadQuestionBank,
  parseQuestionBank,
  type LegacyQuestion,
} from './seed/questionBank.js';
import { QUESTS } from './seed/quests.js';
import { runSeed } from './seed/run.js';
import { createTestPrisma, hasTestDb } from './test/db.js';

describe('question bank parsing (no database)', () => {
  it('reads window.QUESTION_BANK from the old file in a sandbox, without touching the file', () => {
    const bank = loadQuestionBank();
    expect(bank.length).toBeGreaterThan(100);
    expect(findQuestionBankFile()).toMatch(/questions\.js$/);
  });
  it('the sandbox has no access to node globals', () => {
    expect(() => parseQuestionBank('window.QUESTION_BANK = [process.exit(1)]')).toThrow();
    expect(() => parseQuestionBank('window.QUESTION_BANK = 5')).toThrow(/array/);
  });
  it('flags (never edits) malformed entries and reports unusable ones', () => {
    const base = {
      id: 'x-1',
      subject: 'Math',
      difficulty: 'easy',
      text: 'Q?',
      choices: ['a', 'b', 'c'],
      correctIndex: 0,
    };
    const [ok, dupChoices, badIndex, noId, badSubject, twin] = analyzeQuestions([
      base,
      { ...base, id: 'x-2', text: 'Q2?', choices: ['a', 'A ', 'c'] },
      { ...base, id: 'x-3', text: 'Q3?', correctIndex: 7 },
      { ...base, id: '' },
      { ...base, id: 'x-5', text: 'Q5?', subject: 'Astrology' },
      { ...base, id: 'x-6' },
    ]);
    expect(ok).toMatchObject({ usable: true, flags: [] });
    expect(dupChoices?.flags).toContain('duplicate choices');
    expect(badIndex?.flags).toContain('correctIndex is out of range');
    expect(noId?.usable).toBe(false);
    expect(badSubject?.usable).toBe(false);
    expect(twin?.flags[0]).toMatch(/same text as x-1/);
  });
});

describe.skipIf(!hasTestDb)('question bank seed (PostgreSQL)', () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = createTestPrisma();
  });
  afterAll(() => prisma.$disconnect());

  it('stores exactly as many questions as the source file contains (count read from the file, not hardcoded)', async () => {
    const source = loadQuestionBank() as LegacyQuestion[];
    const report = await runSeed(prisma);
    expect(report.questions.sourceCount).toBe(source.length);
    expect(report.questions.stored).toBe(source.length);
    expect(report.questions.skipped).toEqual([]);
    expect(await prisma.question.count()).toBe(source.length);
    console.log(`question bank: ${source.length} questions in the file`);
  });

  it('every correctIndex maps to the same choice text as in the source; nothing else is changed', async () => {
    const source = loadQuestionBank() as LegacyQuestion[];
    const rows = new Map((await prisma.question.findMany()).map((q) => [q.legacyId, q]));
    for (const s of source) {
      const q = rows.get(s.id);
      expect(q, s.id).toBeTruthy();
      expect(q?.choices, s.id).toEqual(s.choices);
      expect(q?.correctIndex, s.id).toBe(s.correctIndex);
      expect(q?.choices[q.correctIndex], s.id).toBe(s.choices[s.correctIndex]);
      expect(q).toMatchObject({
        subject: s.subject,
        difficulty: s.difficulty,
        text: s.text,
        source: 'builtin',
        explanation: null,
      });
    }
  });

  it('seeding twice creates no duplicates and keeps an explanation the owner added', async () => {
    const before = await prisma.question.count();
    const quests = await prisma.questDefinition.count();
    await prisma.question.update({
      where: { legacyId: 'math-e-001' },
      data: { explanation: '6 x 7 = 42' },
    });
    await runSeed(prisma);
    expect(await prisma.question.count()).toBe(before);
    expect(await prisma.questDefinition.count()).toBe(quests);
    expect(
      (await prisma.question.findUniqueOrThrow({ where: { legacyId: 'math-e-001' } })).explanation,
    ).toBe('6 x 7 = 42');
  });

  it('flags the suspicious entries (needsReview) and keeps them in the game', async () => {
    const flagged = await prisma.question.findMany({
      where: { needsReview: true },
      select: { legacyId: true },
    });
    const ids = flagged.map((f) => f.legacyId);
    expect(ids).toContain('hist-h-007');
    expect(ids).toContain('hist-h-004');
    expect(ids).not.toContain('math-e-001');
    expect(await prisma.question.count({ where: { legacyId: 'hist-h-007' } })).toBe(1);
  });

  it('seeds the 5 quest definitions with real metrics', async () => {
    const defs = await prisma.questDefinition.findMany();
    expect(defs).toHaveLength(QUESTS.length);
    expect(defs.filter((d) => d.period === 'daily')).toHaveLength(3);
    expect(defs.filter((d) => d.period === 'weekly')).toHaveLength(2);
  });
});
