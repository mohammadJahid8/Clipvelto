import { z } from "zod";

export const adminUsersSchema = z.object({
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.email(),
      emailVerified: z.boolean(),
      createdAt: z.iso.datetime(),
      lastLoginAt: z.iso.datetime().nullable(),
      purchase: z
        .object({
          packName: z.string(),
          mode: z.enum(["test", "live"]),
          provider: z.enum(["mock", "paddle"]).default("mock"),
          status: z.enum(["paid", "refunded", "review"]),
          date: z.iso.datetime().nullable(),
        })
        .nullable(),
    }),
  ),
});
