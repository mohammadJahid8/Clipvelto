import { Types, type Connection, type ClientSession } from "mongoose";
import { creditPolicy, processingQuote } from "@clipvelto/credit-plans";
import { UploadError } from "../uploads/upload-error.js";
import { creditModels } from "./credit-models.js";
import { paymentHolds } from "../billing/payment-holds.js";

export type CreditMode = "live" | "test";
type LedgerKind =
  | "opening"
  | "purchase"
  | "reserve"
  | "consume"
  | "release"
  | "refund"
  | "exempt";
export function billingCreditMode(env: {
  BILLING_MODE: string;
  PADDLE_ENVIRONMENT?: string;
}): CreditMode {
  return env.BILLING_MODE === "mock" ||
    (env.BILLING_MODE === "paddle" && env.PADDLE_ENVIRONMENT !== "live")
    ? "test"
    : "live";
}

export function createCreditService(
  connection: Connection,
  mode: CreditMode = "live",
) {
  const { Account, Wallet, Grant, Reservation, Ledger } =
    creditModels(connection);
  const holds = paymentHolds(connection, mode);
  const walletId = (userId: string) => `${mode}:${userId}`;
  const reservationId = (videoId: string) => `${mode}:${videoId}`;
  const rateWindows = connection.collection<{
    _id: string;
    count: number;
    expiresAt: Date;
  }>("credit_request_windows");
  async function transaction<T>(
    run: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const session = await connection.startSession();
      try {
        return await session.withTransaction(() => run(session));
      } catch (error) {
        if (
          attempt >= 3 ||
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          error.code !== 11000
        )
          throw error;
      } finally {
        await session.endSession();
      }
    }
  }
  async function account(userId: string, session?: ClientSession) {
    const existing = await Account.findById(userId).session(session ?? null);
    if (existing) return existing;
    await Account.updateOne(
      { _id: userId },
      { $setOnInsert: { _id: userId } },
      { upsert: true, session },
    );
    return (await Account.findById(userId).session(session ?? null))!;
  }
  async function entry(
    userId: string,
    key: string,
    kind: LedgerKind,
    reference: string,
    description: string,
    availableDelta: number,
    reservedDelta: number,
    usedDelta: number,
    session: ClientSession,
  ) {
    await Ledger.create(
      [
        {
          _id: `${walletId(userId)}:${key}`,
          userId,
          walletId: walletId(userId),
          mode,
          kind,
          reference,
          description,
          availableDelta,
          reservedDelta,
          usedDelta,
        },
      ],
      { session },
    );
  }
  async function wallet(userId: string, session: ClientSession) {
    const row = await Wallet.findById(walletId(userId)).session(session);
    if (row) return row;
    const legacy = await account(userId, session);
    const live =
      mode === "test"
        ? await Wallet.findById(`live:${userId}`).session(session)
        : null;
    const initial = live ?? legacy;
    const available = Math.max(0, Math.floor(initial.availableSeconds));
    const reserved =
      mode === "test" ? 0 : Math.max(0, Math.floor(initial.reservedSeconds));
    const used = Math.max(0, Math.floor(initial.usedSeconds));
    const total = available + reserved + used;
    const created = await Wallet.create(
      [
        {
          _id: walletId(userId),
          userId,
          mode,
          availableSeconds: available,
          reservedSeconds: reserved,
          usedSeconds: used,
          grantedSeconds: total,
        },
      ],
      { session },
    );
    await Grant.create(
      [
        {
          _id: `${walletId(userId)}:opening`,
          walletId: walletId(userId),
          userId,
          mode,
          source: "opening",
          seconds: total,
          remainingSeconds: available,
          reservedSeconds: reserved,
          consumedSeconds: used,
        },
      ],
      { session },
    );
    await entry(
      userId,
      "opening",
      "opening",
      userId,
      "Opening balance · existing credits preserved",
      available,
      reserved,
      used,
      session,
    );
    return created[0]!;
  }
  async function findReservation(videoId: string, session?: ClientSession) {
    return Reservation.findOne({
      $or: [
        { _id: reservationId(videoId) },
        ...(mode === "live"
          ? [{ _id: videoId, mode: { $exists: false } }]
          : []),
      ],
    }).session(session ?? null);
  }
  async function allocate(
    userId: string,
    seconds: number,
    session: ClientSession,
  ) {
    let remaining = seconds;
    const allocations: { grantId: string; seconds: number }[] = [];
    const grants = await Grant.find({
      walletId: walletId(userId),
      reversed: false,
      remainingSeconds: { $gt: 0 },
    })
      .sort({ createdAt: 1, _id: 1 })
      .session(session);
    for (const grant of grants) {
      if (!remaining) break;
      const take = Math.min(remaining, grant.remainingSeconds);
      const changed = await Grant.updateOne(
        { _id: grant._id, remainingSeconds: { $gte: take }, reversed: false },
        { $inc: { remainingSeconds: -take, reservedSeconds: take } },
        { session },
      );
      if (!changed.modifiedCount)
        throw new Error("Credit allocation changed during reservation");
      allocations.push({ grantId: grant._id, seconds: take });
      remaining -= take;
    }
    if (remaining) throw new Error("Credit wallet and grants are inconsistent");
    return allocations;
  }
  async function releaseAllocations(
    userId: string,
    allocations: { grantId: string; seconds: number }[],
    spend: boolean,
    session: ClientSession,
  ) {
    for (const item of allocations) {
      const result = await Grant.updateOne(
        {
          _id: item.grantId,
          walletId: walletId(userId),
          reservedSeconds: { $gte: item.seconds },
        },
        {
          $inc: {
            reservedSeconds: -item.seconds,
            ...(spend
              ? { consumedSeconds: item.seconds }
              : { remainingSeconds: item.seconds }),
          },
        },
        { session },
      );
      if (!result.modifiedCount)
        throw new Error("Credit allocation is missing or already settled");
    }
  }
  async function reserve(
    userId: string,
    videoId: string,
    durationSeconds: number,
    session?: ClientSession,
    sizeBytes = 0,
  ): Promise<void> {
    if (!session)
      return transaction((active) =>
        reserve(userId, videoId, durationSeconds, active, sizeBytes),
      );
    const quote = processingQuote(durationSeconds, sizeBytes);
    const current = await wallet(userId, session);
    const role = (await account(userId, session)).role;
    const previous = await findReservation(videoId, session);
    if (previous && previous.userId !== userId)
      throw new UploadError(
        409,
        "CREDIT_OWNER_MISMATCH",
        "This credit reservation belongs to another account.",
      );
    if (previous?.state === "spent" || previous?.state === "exempt") return;
    const oldHeld = previous?.state === "held" ? previous.seconds : 0;
    if (previous?.state === "held" && oldHeld === quote.seconds) return;
    if (role !== "admin") await holds.assertClear(userId, session);
    const revision = (previous?.revision ?? 0) + 1;
    if (role === "admin") {
      if (oldHeld)
        throw new UploadError(
          409,
          "CREDIT_ROLE_CHANGED",
          "Finish or cancel the existing reservation before changing its billing role.",
        );
      await Reservation.updateOne(
        { _id: previous?._id ?? reservationId(videoId) },
        {
          $set: {
            userId,
            videoId,
            mode,
            seconds: 0,
            state: "exempt",
            reason: "Administrator",
            revision,
            policyVersion: creditPolicy.version,
          },
        },
        { upsert: true, session },
      );
      await entry(
        userId,
        `exempt:${videoId}:${revision}`,
        "exempt",
        videoId,
        "Administrator processing · no credit charge",
        0,
        0,
        0,
        session,
      );
      return;
    }
    const additional = quote.seconds - oldHeld;
    const changed = await Wallet.updateOne(
      {
        _id: current._id,
        userId,
        mode,
        availableSeconds: { $gte: Math.max(0, additional) },
        reservedSeconds: { $gte: oldHeld },
      },
      { $inc: { availableSeconds: -additional, reservedSeconds: additional } },
      { session },
    );
    if (!changed.modifiedCount)
      throw new UploadError(
        402,
        "INSUFFICIENT_CREDITS",
        `This video needs ${Number((quote.seconds / 60).toFixed(2))} credits. Add credits to continue. Your existing balance is safe.`,
      );
    if (oldHeld) {
      const oldAllocations = previous?.allocations?.length
        ? previous.allocations.map((item) => ({
            grantId: item.grantId,
            seconds: item.seconds,
          }))
        : [{ grantId: `${walletId(userId)}:opening`, seconds: oldHeld }];
      await releaseAllocations(userId, oldAllocations, false, session);
    }
    const allocations = await allocate(userId, quote.seconds, session);
    await Reservation.updateOne(
      { _id: previous?._id ?? reservationId(videoId) },
      {
        $set: {
          userId,
          videoId,
          mode,
          seconds: quote.seconds,
          state: "held",
          reason: "Video processing",
          revision,
          policyVersion: creditPolicy.version,
          allocations,
        },
      },
      { upsert: true, session },
    );
    await entry(
      userId,
      `reserve:${videoId}:${revision}`,
      "reserve",
      videoId,
      oldHeld
        ? "Video reservation adjusted to verified duration"
        : "Video processing reserved",
      -additional,
      additional,
      0,
      session,
    );
  }
  async function settle(
    videoId: string,
    spent: boolean,
    externalSession?: ClientSession,
    description?: string,
  ) {
    async function run(session: ClientSession) {
      const item = await findReservation(videoId, session);
      if (!item || item.state !== "held") return;
      await wallet(item.userId, session);
      const allocations = item.allocations?.length
        ? item.allocations.map((value) => ({
            grantId: value.grantId,
            seconds: value.seconds,
          }))
        : [
            {
              grantId: `${walletId(item.userId)}:opening`,
              seconds: item.seconds,
            },
          ];
      const changed = await Reservation.updateOne(
        { _id: item._id, userId: item.userId, state: "held" },
        { $set: { state: spent ? "spent" : "refunded" } },
        { session },
      );
      if (!changed.modifiedCount) return;
      await releaseAllocations(item.userId, allocations, spent, session);
      const updated = await Wallet.updateOne(
        {
          _id: walletId(item.userId),
          userId: item.userId,
          reservedSeconds: { $gte: item.seconds },
        },
        {
          $inc: {
            reservedSeconds: -item.seconds,
            ...(spent
              ? { usedSeconds: item.seconds }
              : { availableSeconds: item.seconds }),
          },
        },
        { session },
      );
      if (!updated.modifiedCount)
        throw new Error("Credit reservation exceeds the wallet hold");
      await entry(
        item.userId,
        `${spent ? "consume" : "release"}:${item._id}:${item.revision ?? 0}`,
        spent ? "consume" : "release",
        item.videoId ?? videoId,
        description ??
          (spent
            ? "Processing credits used"
            : "Processing reservation returned"),
        spent ? 0 : item.seconds,
        -item.seconds,
        spent ? item.seconds : 0,
        session,
      );
    }
    return externalSession ? run(externalSession) : transaction(run);
  }
  async function grantPurchase(
    userId: string,
    reference: string,
    seconds: number,
    session: ClientSession,
  ) {
    if (!Number.isSafeInteger(seconds) || seconds <= 0)
      throw new Error("Invalid credit grant");
    await wallet(userId, session);
    const id = `${walletId(userId)}:purchase:${reference}`;
    if (await Grant.exists({ _id: id, userId, mode }).session(session)) return;
    await Grant.create(
      [
        {
          _id: id,
          walletId: walletId(userId),
          userId,
          mode,
          source: "purchase",
          seconds,
          remainingSeconds: seconds,
          reservedSeconds: 0,
          consumedSeconds: 0,
        },
      ],
      { session },
    );
    const added = await Wallet.updateOne(
      {
        _id: walletId(userId),
        userId,
        mode,
        grantedSeconds: { $lte: Number.MAX_SAFE_INTEGER - seconds },
      },
      { $inc: { availableSeconds: seconds, grantedSeconds: seconds } },
      { session },
    );
    if (!added.modifiedCount)
      throw new UploadError(
        409,
        "BALANCE_TOO_LARGE",
        "This balance needs support review before adding another pack.",
      );
    await entry(
      userId,
      `purchase:${reference}`,
      "purchase",
      reference,
      "Credit pack added",
      seconds,
      0,
      0,
      session,
    );
  }
  async function reversePurchase(
    userId: string,
    reference: string,
    session: ClientSession,
  ) {
    const grant = await Grant.findOne({
      _id: `${walletId(userId)}:purchase:${reference}`,
      userId,
      mode,
    }).session(session);
    if (!grant || grant.reversed) return;
    if (
      grant.remainingSeconds !== grant.seconds ||
      grant.reservedSeconds ||
      grant.consumedSeconds
    )
      throw new UploadError(
        409,
        "PACK_ALREADY_USED",
        "Only an entirely unused credit pack can be refunded in this simulator.",
      );
    const changed = await Wallet.updateOne(
      {
        _id: walletId(userId),
        userId,
        mode,
        availableSeconds: { $gte: grant.seconds },
      },
      {
        $inc: {
          availableSeconds: -grant.seconds,
          grantedSeconds: -grant.seconds,
        },
      },
      { session },
    );
    if (!changed.modifiedCount)
      throw new UploadError(
        409,
        "CREDITS_RESERVED",
        "Some credits are reserved by a job. Finish or cancel it first.",
      );
    await Grant.updateOne(
      { _id: grant._id, remainingSeconds: grant.seconds, reversed: false },
      { $set: { remainingSeconds: 0, reversed: true } },
      { session },
    );
    await entry(
      userId,
      `refund:${reference}`,
      "refund",
      reference,
      "Unused credit pack refunded",
      -grant.seconds,
      0,
      0,
      session,
    );
  }
  const service = {
    mode,
    Account,
    Wallet,
    Grant,
    Reservation,
    Ledger,
    account,
    ensureWallet: wallet,
    reserve,
    transaction,
    grantPurchase,
    reversePurchase,
    init: () =>
      Promise.all([
        Account.init(),
        Wallet.init(),
        Grant.init(),
        Reservation.init(),
        Ledger.init(),
        rateWindows.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]),
    async allowSubmit(userId: string) {
      const minute = Math.floor(Date.now() / 60000);
      const record = await rateWindows.findOneAndUpdate(
        { _id: `${userId}:${minute}` },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date((minute + 2) * 60000) },
        },
        { upsert: true, returnDocument: "after" },
      );
      if ((record?.count ?? 0) > 60)
        throw new UploadError(
          429,
          "TOO_MANY_REQUESTS",
          "Too many requests. Please wait a minute and try again.",
        );
    },
    reserveWork: (
      userId: string,
      videoId: string,
      seconds: number,
      sizeBytes = 0,
    ) =>
      transaction((session) =>
        reserve(userId, videoId, seconds, session, sizeBytes),
      ),
    commit: (videoId: string, session?: ClientSession) =>
      settle(videoId, true, session),
    refund: (videoId: string, session?: ClientSession) =>
      settle(videoId, false, session),
    async cancelWork(
      userId: string,
      videoId: string,
      completedSeconds: number,
      session: ClientSession,
    ) {
      const previous = await findReservation(videoId, session);
      if (!previous || previous.userId !== userId || previous.state !== "held")
        return;
      if (completedSeconds <= 0) return settle(videoId, false, session);
      await reserve(
        userId,
        videoId,
        Math.min(previous.seconds, Math.max(60, Math.ceil(completedSeconds))),
        session,
      );
      await settle(
        videoId,
        true,
        session,
        "Cancelled video: completed processing charged",
      );
    },
    async reservation(
      userId: string,
      videoId: string,
      session?: ClientSession,
    ) {
      const item = await findReservation(videoId, session);
      return item?.userId === userId ? item : null;
    },
    async reconcile() {
      const items = await Reservation.find({
        state: "held",
        ...(mode === "test"
          ? { mode }
          : { $or: [{ mode }, { mode: { $exists: false } }] }),
        updatedAt: { $lt: new Date(Date.now() - 120000) },
      }).limit(100);
      for (const item of items) {
        const id = item.videoId ?? item._id;
        if (!Types.ObjectId.isValid(id)) continue;
        const video = await connection
          .collection("videos")
          .findOne({ _id: new Types.ObjectId(id) });
        if (video?.clipStatus === "completed" && video?.clips?.length)
          await settle(id, true);
        else if (
          !video ||
          (video.status !== "deleting" &&
            video.status !== "cancelled" &&
            (video.status === "failed" ||
              video.clipStatus === "failed" ||
              video.transcriptionStatus === "failed"))
        )
          await settle(id, false);
      }
    },
    async summary(userId: string) {
      const row = await transaction((session) => wallet(userId, session));
      const identity = await account(userId);
      return {
        mode,
        role: identity.role as "admin" | "free",
        available: identity.role === "admin" ? null : row.availableSeconds / 60,
        reserved: row.reservedSeconds / 60,
        used: row.usedSeconds / 60,
        purchased:
          ((
            await Grant.aggregate<{ total: number }>([
              {
                $match: {
                  walletId: walletId(userId),
                  source: "purchase",
                  reversed: false,
                },
              },
              { $group: { _id: null, total: { $sum: "$seconds" } } },
            ])
          )[0]?.total ?? 0) / 60,
        allowance: 15,
        status:
          identity.role === "admin"
            ? ("unlimited" as const)
            : ("available" as const),
      };
    },
    async history(userId: string) {
      return Reservation.find({
        userId,
        ...(mode === "test"
          ? { mode }
          : { $or: [{ mode }, { mode: { $exists: false } }] }),
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .select("_id seconds state reason createdAt")
        .lean();
    },
    async ledgerHistory(userId: string) {
      await transaction((session) => wallet(userId, session));
      return Ledger.find({ walletId: walletId(userId), userId, mode })
        .sort({ createdAt: -1, _id: -1 })
        .limit(100)
        .lean();
    },
    async claimTrial(
      userId: string,
      videoId: string,
      seconds: number,
      session: ClientSession,
    ) {
      await reserve(userId, videoId, seconds, session);
      // Claiming delivers an already playable preview, so its charge can settle now.
      await settle(videoId, true, session);
      await Reservation.updateOne(
        { _id: reservationId(videoId), userId },
        { $set: { reason: "Homepage trial" } },
        { session },
      );
    },
  };
  return service;
}
export type CreditService = ReturnType<typeof createCreditService>;
