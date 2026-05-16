import { selectReporterSchema } from '@aj-now/db/zod';
import type { z } from 'zod';

export const ReporterSchema = selectReporterSchema.omit({
  external_id: true,
  device_pubkey: true,
});
export type Reporter = z.infer<typeof ReporterSchema>;
