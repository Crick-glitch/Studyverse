import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './lib/prisma.js';
import { applyExplanations, buildExplanationDraft } from './seed/explanations.js';
import { loadQuestionBank } from './seed/questionBank.js';

describe('explanation review file', () => {
  it('has one entry per usable question, all empty and unapproved (nothing is invented)', () => {
    const bank = loadQuestionBank();
    const draft = buildExplanationDraft(bank);
    expect(draft.length).toBeGreaterThan(100);
    expect(draft.length).toBeLessThanOrEqual(bank.length);
    expect(draft.every((e) => e.explanation === '' && e.approved === false)).toBe(true);
    expect(draft.every((e) => e.correctAnswer !== '')).toBe(true);
  });

  it('applies only approved, non-empty explanations and writes nothing else', async () => {
    const updateMany = vi.fn(({ where }: { where: { legacyId: string } }) =>
      Promise.resolve({ count: where.legacyId === 'nope' ? 0 : 1 }),
    );
    const prisma = { question: { updateMany } } as unknown as PrismaClient;
    const report = await applyExplanations(prisma, [
      { legacyId: 'a', explanation: ' Because. ', approved: true },
      { legacyId: 'b', explanation: 'Draft only', approved: false },
      { legacyId: 'c', explanation: '   ', approved: true },
      { legacyId: 'nope', explanation: 'x', approved: true },
    ]);
    expect(report).toEqual({ applied: 1, skippedNotApproved: 1, skippedEmpty: 1, unknownIds: ['nope'] });
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[0]?.[0]).toEqual({
      where: { legacyId: 'a' },
      data: { explanation: 'Because.' },
    });
  });
});
