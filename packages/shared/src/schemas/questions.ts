import { z } from 'zod';
import { cleanLineSchema } from '../subjects.js';

export const questionReportSchema = z
  .object({ reason: cleanLineSchema(1, 300, 'Reason').optional() })
  .strict();
export type QuestionReport = z.infer<typeof questionReportSchema>;
