import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from './lib/prisma.js';
import { runSeed } from './seed/run.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';

/** Parses prisma/schema.prisma into { Model: { column: nullable } } (scalar columns only). */
function schemaColumns(): Record<string, Record<string, boolean>> {
  const src = readFileSync(join(import.meta.dirname, '../prisma/schema.prisma'), 'utf8').replace(
    /\/\/[^\n]*/g,
    '',
  );
  const modelNames = [...src.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1] as string);
  const out: Record<string, Record<string, boolean>> = {};
  for (const m of src.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const cols: Record<string, boolean> = {};
    for (const line of (m[2] as string).split('\n')) {
      const f = /^\s*(\w+)\s+(\w+)(\[\]|\?)?/.exec(line);
      if (!f || line.trim().startsWith('@@')) continue;
      const [, name, type, mod] = f as unknown as [string, string, string, string | undefined];
      if (modelNames.includes(type)) continue; // relation field, not a column
      cols[name] = mod === '?' || mod === '[]';
    }
    out[m[1] as string] = cols;
  }
  return out;
}

describe.skipIf(!hasTestDb)('database schema (PostgreSQL)', () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = createTestPrisma();
  });
  afterAll(() => prisma.$disconnect());

  it('the migrated tables and columns match schema.prisma exactly (drift check)', async () => {
    const expected = schemaColumns();
    const rows = await prisma.$queryRaw<
      { table_name: string; column_name: string; is_nullable: string }[]
    >`
      SELECT table_name, column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public'`;
    const actual: Record<string, Record<string, boolean>> = {};
    for (const r of rows) (actual[r.table_name] ??= {})[r.column_name] = r.is_nullable === 'YES';
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const [table, cols] of Object.entries(expected))
      expect(actual[table], table).toEqual(cols);
  });

  it('every foreign-key column is indexed (first column of some index)', async () => {
    const rows = await prisma.$queryRaw<{ tbl: string; col: string; indexed: boolean }[]>`
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col,
        EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid AND i.indkey[0] = a.attnum
        ) AS indexed
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`;
    expect(rows.length).toBeGreaterThan(15);
    expect(rows.filter((r) => !r.indexed)).toEqual([]);
  });

  it('row level security is enabled on every table and no policies exist', async () => {
    const tables = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`;
    expect(tables.length).toBe(22);
    expect(tables.filter((t) => !t.relrowsecurity)).toEqual([]);
    const policies = await prisma.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public'`;
    expect(Number(policies[0]?.n)).toBe(0);
  });

  it('the ledger source is unique per user', async () => {
    const u = await newPlayer(prisma);
    const row = {
      userId: u,
      amount: 1,
      reason: 'r',
      sourceType: 's',
      sourceId: 'id',
      levelAfter: 1,
    };
    await prisma.xpTransaction.create({ data: row });
    await expect(prisma.xpTransaction.create({ data: row })).rejects.toThrow();
  });

  it('an equipped item must belong to the equipment owner', async () => {
    await runSeed(prisma);
    const def = await prisma.itemDefinition.findUniqueOrThrow({ where: { slug: 'iron-sword' } });
    const alice = await newPlayer(prisma);
    const bob = await newPlayer(prisma);
    const bobsSword = await prisma.playerItem.create({
      data: { userId: bob, itemDefinitionId: def.id, source: 'test' },
    });
    const aliceSword = await prisma.playerItem.create({
      data: { userId: alice, itemDefinitionId: def.id, source: 'test' },
    });
    await expect(
      prisma.equipment.create({ data: { userId: alice, weaponItemId: bobsSword.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.equipment.create({ data: { userId: alice, weaponItemId: aliceSword.id } }),
    ).resolves.toBeTruthy();
  });

  it('deleting a player cascades to all of their data, including equipped items', async () => {
    const def = await prisma.itemDefinition.findUniqueOrThrow({ where: { slug: 'iron-sword' } });
    const u = await newPlayer(prisma);
    const item = await prisma.playerItem.create({
      data: { userId: u, itemDefinitionId: def.id, source: 'test' },
    });
    await prisma.equipment.create({ data: { userId: u, weaponItemId: item.id } });
    await prisma.task.create({ data: { userId: u, title: 't' } });
    await prisma.playerProfile.delete({ where: { id: u } });
    expect(await prisma.playerItem.count({ where: { userId: u } })).toBe(0);
    expect(await prisma.equipment.count({ where: { userId: u } })).toBe(0);
    expect(await prisma.task.count({ where: { userId: u } })).toBe(0);
  });

  it('the seed is repeatable: running it twice creates no duplicates', async () => {
    const first = await runSeed(prisma);
    const counts = async () => [
      await prisma.itemDefinition.count(),
      await prisma.skillDefinition.count(),
      await prisma.achievement.count(),
    ];
    const afterFirst = await counts();
    await runSeed(prisma);
    expect(await counts()).toEqual(afterFirst);
    expect(afterFirst).toEqual([first.items, first.skills, first.achievements]);
    expect(first.items).toBe(12);
    expect(first.skills).toBe(9);
  });

  it('skill prerequisites only reference skills that exist', async () => {
    await runSeed(prisma);
    const skills = await prisma.skillDefinition.findMany();
    const slugs = new Set(skills.map((s) => s.slug));
    for (const s of skills)
      for (const p of s.prerequisites) expect(slugs.has(p), `${s.slug} -> ${p}`).toBe(true);
  });
});
