import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPrisma } from '../lib/prisma.js';
import { applyExplanations, buildExplanationDraft, type ExplanationDraftEntry } from './explanations.js';
import { loadQuestionBank } from './questionBank.js';

/**
 * npm run explanations:draft [file]  -> writes the review file (no database needed)
 * npm run explanations:apply [file]  -> stores the entries marked approved:true
 */
const [mode, fileArg] = process.argv.slice(2);
const file = fileArg ?? join(import.meta.dirname, '../../../../docs/explanations-review.json');

if (mode === 'draft') {
  if (existsSync(file)) {
    console.error(`${file} already exists; move it first so your edits are not overwritten.`);
    process.exit(1);
  }
  const draft = buildExplanationDraft(loadQuestionBank());
  writeFileSync(file, `${JSON.stringify(draft, null, 2)}\n`);
  console.log(`Wrote ${draft.length} entries to ${file}. Fill "explanation", set "approved": true, then run explanations:apply.`);
} else if (mode === 'apply') {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!url) {
    console.error('DATABASE_URL is not set (see apps/api/.env.example).');
    process.exit(1);
  }
  const entries = JSON.parse(readFileSync(file, 'utf8')) as ExplanationDraftEntry[];
  const prisma = createPrisma(url);
  applyExplanations(prisma, entries)
    .then((r) => console.log('Explanations applied:', r))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
} else {
  console.error('Usage: explanations:draft [file] | explanations:apply [file]');
  process.exit(1);
}
