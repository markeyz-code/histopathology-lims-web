import { z } from 'zod';

export const reportDataSchema = z.record(
  z.union([
    z.string().max(20_000),
    z.number(),
    z.boolean(),
    z.array(z.string().max(2_000)).max(100),
    z.null(),
  ]),
);
export type ReportDataInput = z.infer<typeof reportDataSchema>;
