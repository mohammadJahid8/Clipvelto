import { Router } from "express";
import { Types, type Connection } from "mongoose";
import { z } from "zod";
import type { CreditService } from "../credits/credit-service.js";
import type { createBillingService } from "../billing/billing-service.js";
import { UploadError } from "../uploads/upload-error.js";

const pageSize = 25;
const querySchema = z
  .object({
    cursor: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
  })
  .strict();

type Purchase = {
  _id: { userId: string; status: "paid" | "refunded" | "review" };
  packName: string;
  mode: "test" | "live";
  provider?: "mock" | "paddle";
  paidAt?: Date;
  refundedAt?: Date;
};

export function adminRoutes(
  connection: Connection,
  credits: CreditService,
  billing: ReturnType<typeof createBillingService>,
) {
  const router = Router();
  // Mounted behind requireSession. Recheck the stored role on every request;
  // neither a client-supplied flag nor a stale session grants administrator access.
  router.use(async (_req, res, next) => {
    const admin = await credits.Account.exists({
      _id: res.locals.session.user.id,
      role: "admin",
    });
    if (!admin)
      throw new UploadError(
        403,
        "ADMIN_REQUIRED",
        "Administrator access required.",
      );
    next();
  });

  router.get("/users", async (req, res) => {
    const query = querySchema.safeParse(req.query);
    if (!query.success)
      throw new UploadError(400, "INVALID_PAGE", "Choose a valid users page.");
    const db = connection.db!;
    const users = db.collection<{
      _id: Types.ObjectId;
      name: string;
      email: string;
      emailVerified: boolean;
      createdAt: Date;
    }>("user");
    const [rows, total] = await Promise.all([
      users
        .find(
          query.data.cursor
            ? { _id: { $lt: new Types.ObjectId(query.data.cursor) } }
            : {},
          {
            projection: {
              _id: 1,
              name: 1,
              email: 1,
              emailVerified: 1,
              createdAt: 1,
            },
          },
        )
        .sort({ _id: -1 })
        .limit(pageSize + 1)
        .toArray(),
      users.countDocuments({}),
    ]);
    const page = rows.slice(0, pageSize);
    const ids = page.map((user) => String(user._id));
    const [activity, sessions, purchases] = await Promise.all([
      db
        .collection<{ _id: string; lastLoginAt: Date }>("auth_login_activity")
        .find({ _id: { $in: ids } }, { projection: { lastLoginAt: 1 } })
        .toArray(),
      // Existing session creation dates are reliable historical sign-ins.
      // Never use updatedAt: rolling session refreshes aren't new sign-ins.
      db
        .collection("session")
        .aggregate<{ _id: string | Types.ObjectId; lastLoginAt: Date }>([
          {
            $match: {
              userId: { $in: [...ids, ...page.map((user) => user._id)] },
            },
          },
          { $group: { _id: "$userId", lastLoginAt: { $max: "$createdAt" } } },
        ])
        .toArray(),
      billing.Order.aggregate<Purchase>([
        {
          $match: {
            userId: { $in: ids },
            mode: credits.mode,
            status: { $in: ["paid", "refunded", "review"] },
          },
        },
        { $sort: { paidAt: -1, _id: -1 } },
        {
          $group: {
            _id: { userId: "$userId", status: "$status" },
            packName: { $first: "$packName" },
            mode: { $first: "$mode" },
            provider: { $first: "$provider" },
            paidAt: { $first: "$paidAt" },
            refundedAt: { $first: "$refundedAt" },
          },
        },
      ]),
    ]);
    const lastLogins = new Map<string, Date>();
    for (const row of [...activity, ...sessions]) {
      const id = String(row._id);
      if (
        row.lastLoginAt instanceof Date &&
        (!lastLogins.has(id) || row.lastLoginAt > lastLogins.get(id)!)
      )
        lastLogins.set(id, row.lastLoginAt);
    }
    const purchaseMap = new Map<string, Purchase>();
    for (const purchase of purchases) {
      const id = purchase._id.userId;
      // A refunded order must not hide another successful purchase.
      const rank = { refunded: 0, paid: 1, review: 2 };
      if (
        !purchaseMap.has(id) ||
        rank[purchase._id.status] > rank[purchaseMap.get(id)!._id.status]
      )
        purchaseMap.set(id, purchase);
    }
    res.json({
      total,
      users: page.map((user) => {
        const id = String(user._id);
        const purchase = purchaseMap.get(id);
        return {
          id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          lastLoginAt: lastLogins.get(id) ?? null,
          purchase: purchase
            ? {
                packName: purchase.packName,
                mode: purchase.mode,
                provider: purchase.provider ?? "mock",
                status: purchase._id.status,
                date:
                  (purchase._id.status === "refunded"
                    ? purchase.refundedAt
                    : purchase.paidAt) ?? null,
              }
            : null,
        };
      }),
      nextCursor: rows.length > pageSize ? String(page.at(-1)!._id) : null,
    });
  });
  return router;
}
