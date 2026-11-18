"use client";
import { useEffect, useRef, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";
import { CircleCheck, Coins, FlaskConical, Info, LoaderCircle, X } from "lucide-react";
import {
  creditPacks,
  creditPolicy,
  type CreditPackId,
} from "@clipvelto/credit-plans";
import { clientApi } from "@/lib/client-api";
import {
  billingSchema,
  orderSchema,
  type Billing,
  type BillingOrder,
} from "@/lib/billing-schema";
import { CreditPackCards } from "./credit-pack-cards";

const number = (value: number) =>
  Number(value.toFixed(2)).toLocaleString("en-US");
const currentPackPrice = (order: BillingOrder) =>
  order.taxMode === creditPolicy.taxMode &&
  creditPacks.some(
    (pack) =>
      pack.id === order.packId &&
      pack.priceCents === order.priceCents &&
      pack.credits === order.credits,
  );
const date = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
export function BillingWorkspace({ initial }: { initial: Billing }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const request = useRef<{ packId: CreditPackId; id: string } | null>(null);
  const lock = useRef(false);
  const paddle = useRef<Paddle | undefined>(undefined);
  const activePaddleOrder = useRef<BillingOrder | null>(null);
  const confirmationLock = useRef(false);
  const confirmationRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const paymentLinkHandled = useRef(false);
  const refreshSequence = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      confirmationRequest.current?.abort();
      paddle.current?.Checkout.close();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => {
      if (
        document.visibilityState !== "visible" ||
        lock.current ||
        confirmationLock.current
      )
        return;
      const sequence = ++refreshSequence.current;
      void clientApi("/billing", { signal: controller.signal })
        .then((value) => {
          if (mounted.current && sequence === refreshSequence.current)
            setData(billingSchema.parse(value));
        })
        .catch(() => undefined);
    };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    const timer = window.setInterval(update, 15000);
    update();
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  async function refresh() {
    const sequence = ++refreshSequence.current;
    const latest = billingSchema.parse(await clientApi("/billing"));
    if (mounted.current && sequence === refreshSequence.current)
      setData(latest);
    return latest;
  }
  async function verifyPayment(selected: BillingOrder, returnToWorkspace = false) {
    if (confirmationLock.current) return;
    confirmationLock.current = true;
    const controller = new AbortController();
    confirmationRequest.current = controller;
    let returning = false;
    refreshSequence.current++;
    setBusy(true);
    setConfirming(true);
    setError("");
    setNotice(
      "Confirming your payment. Credits are added after Paddle confirms it.",
    );
    try {
      let confirmed = selected;
      // Paddle may emit checkout.completed just before its transaction is
      // finalized. Give the server a bounded window to verify it safely.
      for (let attempt = 0; attempt < 5; attempt++) {
        controller.signal.throwIfAborted();
        const result = (await clientApi(
          `/billing/orders/${encodeURIComponent(selected._id)}/sync`,
          {
            method: "POST",
            body: "{}",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(10000),
            ]),
          },
        )) as { order: unknown };
        confirmed = orderSchema.parse(result.order);
        if (confirmed.status !== "pending" || !returnToWorkspace) break;
        if (attempt < 4)
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
      if (!mounted.current) return;
      setOrder(confirmed);
      request.current = null;
      if (confirmed.status === "paid" && returnToWorkspace) {
        returning = true;
        setNotice("Payment confirmed. Opening your workspace…");
        router.replace(`/dashboard?purchase=${encodeURIComponent(confirmed._id)}`);
        return;
      }
      await refresh();
      if (!mounted.current) return;
      setNotice(
        confirmed.status === "paid"
          ? `${confirmed.credits} ${confirmed.mode === "test" ? "test credits" : "credits"} added.`
          : confirmed.status === "review"
            ? "This payment needs review. Contact support."
            : confirmed.status === "refunded"
              ? "This payment has been refunded."
              : confirmed.status === "failed" || confirmed.status === "cancelled"
                ? "Payment didn’t complete. No credits were added."
              : "Payment is still pending. You can check it again under Purchases.",
      );
    } catch {
      if (mounted.current && !controller.signal.aborted) {
        setNotice("");
        setError(
          "We couldn’t confirm the payment yet. Check Purchases before paying again.",
        );
      }
    } finally {
      confirmationLock.current = false;
      if (mounted.current && !returning) {
        setConfirming(false);
        setBusy(false);
      }
    }
  }
  async function openPaddle(selected: BillingOrder) {
    if (selected.status === "pending" && !currentPackPrice(selected))
      throw new Error(
        "Pack prices have changed. Choose a pack above to start a new checkout.",
      );
    if (!data.checkout.clientToken || !selected.paddleTransactionId)
      throw new Error(
        "This checkout is still being prepared. Refresh purchases and try again.",
      );
    activePaddleOrder.current = selected;
    paddle.current = await initializePaddle({
      token: data.checkout.clientToken,
      environment:
        data.checkout.environment === "sandbox" ? "sandbox" : "production",
      eventCallback(event) {
        const active = activePaddleOrder.current;
        if (!active || !mounted.current) return;
        if (
          event.name === "checkout.completed" &&
          event.data?.transaction_id === active.paddleTransactionId
        ) {
          // This only asks our server to verify Paddle's current transaction.
          // Browser events never change credits themselves.
          activePaddleOrder.current = null;
          paddle.current?.Checkout.close();
          void verifyPayment(active, true);
        } else if (
          event.name === "checkout.payment.failed" ||
          event.name === "checkout.error"
        ) {
          setError(
            "Payment didn’t finish. Check the checkout details or try another payment method.",
          );
        }
      },
    });
    if (!paddle.current)
      throw new Error(
        "Checkout couldn’t load. Check your connection and try again.",
      );
    if (!mounted.current) return;
    paddle.current.Checkout.open({
      transactionId: selected.paddleTransactionId,
      customer: { email: data.checkout.customerEmail },
      settings: {
        displayMode: "overlay",
        theme:
          document.documentElement.dataset.theme === "dark" ? "dark" : "light",
        showAddDiscounts: data.checkout.allowDiscounts,
        allowDiscountRemoval: false,
      },
    });
  }
  useEffect(() => {
    if (data.checkout.provider !== "paddle" || paymentLinkHandled.current)
      return;
    const url = new URL(window.location.href);
    const transactionId = url.searchParams.get("_ptxn");
    if (!transactionId) return;
    paymentLinkHandled.current = true;
    // Validate ownership before Paddle.js sees and automatically opens a link.
    url.searchParams.delete("_ptxn");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    if (!/^txn_[a-z0-9]{26}$/.test(transactionId)) {
      setError("This payment link is invalid.");
      return;
    }
    void clientApi(`/billing/paddle/${encodeURIComponent(transactionId)}`)
      .then(async (result) => {
        if (!mounted.current) return;
        const selected = orderSchema.parse(
          (result as { order: unknown }).order,
        );
        if (selected.status === "pending") await openPaddle(selected);
        else await verifyPayment(selected);
      })
      .catch(() => {
        if (mounted.current)
          setError("This payment link is not available in this account.");
      });
  }, [data.checkout.provider]);
  async function choose(packId: CreditPackId) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    if (!request.current || request.current.packId !== packId)
      request.current = { packId, id: crypto.randomUUID() };
    try {
      const result = (await clientApi("/billing/orders", {
        method: "POST",
        body: JSON.stringify({ packId, requestId: request.current.id }),
      })) as { order: unknown };
      const selected = orderSchema.parse(result.order);
      setOrder(selected);
      if (selected.provider === "paddle") {
        if (selected.status === "pending") await openPaddle(selected);
        else {
          request.current = null;
          setNotice(`Payment ${selected.status}.`);
        }
      } else setOpen(true);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Checkout couldn’t open. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function simulate(
    action: "success" | "failure" | "cancel" | "refund",
    selected = order,
  ) {
    if (!selected || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = (await clientApi(
        `/billing/orders/${encodeURIComponent(selected._id)}/simulate`,
        { method: "POST", body: JSON.stringify({ action }) },
      )) as { order: unknown };
      const finished = orderSchema.parse(result.order);
      setOrder(finished);
      request.current = null;
      setNotice(
        action === "success"
          ? `${finished.credits} test credits added. You can continue your video.`
          : action === "refund"
            ? "Unused test credits refunded."
            : action === "failure"
              ? "Test payment declined. No credits added."
              : "Checkout cancelled. No credits added.",
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The payment action couldn’t finish. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="dashboard-page-heading">
        <div>
          <h1>Credits & billing</h1>
          <p>Add credits when you need them. No subscription.</p>
        </div>
      </div>
      {(data.mock ||
        (data.checkout.provider === "paddle" &&
          data.checkout.environment === "sandbox")) && (
        <div className="billing-test-note">
          <FlaskConical size={22} aria-hidden="true" />
          <div>
            <strong>{data.mock ? "Payment testing" : "Paddle sandbox"}</strong>
            <p>
              No real money is charged. Purchases use a separate test wallet.
              Video processing still uses real services.
            </p>
            {!data.mock && (
              <p>Test receipts go to the main email on your Paddle sandbox account.</p>
            )}
          </div>
        </div>
      )}
      {data.paymentReview && (
        <p className="form-alert" role="alert">
          A payment adjustment needs review.{" "}
          <Link href="/contact">Contact support</Link> before starting another
          video.
        </p>
      )}
      <section className="billing-balances" aria-label="Credit balance">
        {[
          [
            "Available",
            data.credits.available === null
              ? "Unlimited"
              : number(data.credits.available),
          ],
          ["Reserved for jobs", number(data.credits.reserved)],
          ["Used", number(data.credits.used)],
        ].map(([label, value]) => (
          <article className="workspace-panel" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>
              {data.credits.mode === "test" ? "test credits" : "credits"}
            </span>
          </article>
        ))}
      </section>
      {data.pendingRemovals > 0 && (
        <p className="billing-notice" role="status">
          {data.pendingRemovals === 1
            ? "A video is"
            : `${data.pendingRemovals} videos are`}{" "}
          being deleted. Stored files are removed in the background. Used
          credits are not refunded.
        </p>
      )}
      <p className="billing-help">
        {data.credits.role === "admin"
          ? "Administrator processing is exempt from credit charges. "
          : "Your account starts with 15 free credits, including any homepage trial. "}
        We reserve the quoted credits before processing, charge when clips are
        ready, and return the reservation if processing fails. Submitted jobs
        can’t be cancelled. You can delete completed videos; used credits are
        not refunded.
      </p>
      {notice && (
        <p role="status" className="billing-notice">
          {confirming ? (
            <LoaderCircle size={20} className="loading-spinner" aria-hidden="true" />
          ) : order?.status === "paid" ? (
            <CircleCheck size={20} aria-hidden="true" />
          ) : (
            <Info size={20} aria-hidden="true" />
          )}
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="form-alert">
          {error}
        </p>
      )}
      <section className="billing-packs" aria-labelledby="packs-title">
        <h2 id="packs-title">Choose your credit pack</h2>
        <p>
          Every pack includes the same features. Larger packs cost less per
          minute.
        </p>
        <CreditPackCards
          onChoose={choose}
          disabled={busy || !data.checkout.enabled || data.paymentReview}
        />
        <p className="billing-help">
          1 credit covers 1 source-video minute, measured in seconds, with a
          1-credit minimum per video. Large files have a storage minimum of 2
          credits per GB for 30 days; the higher quote applies. Previews and
          downloads cost nothing extra. Purchased credits never expire. New
          media is kept for 30 days.
        </p>
        {data.checkout.provider === "paddle" && (
          <p className="billing-help">
            Secure checkout by Paddle. Applicable tax is added at checkout.
            You’ll see the final total before paying.
          </p>
        )}
        {!data.checkout.enabled && (
          <p className="billing-test-note">
            Purchases are not enabled yet. Your existing credits are available.
          </p>
        )}
      </section>
      <section className="workspace-panel billing-history">
        <h2>Purchases</h2>
        {data.orders.length ? (
          <ul>
            {data.orders.map((item) => (
              <li key={item._id}>
                <div>
                  <strong>
                    {item.packName} · {item.credits}{" "}
                    {item.mode === "test" ? "test credits" : "credits"}
                  </strong>
                  <p>
                    {date(item.createdAt)} UTC · $
                    {((item.paidTotalCents ?? item.priceCents) / 100).toFixed(2)}
                    {item.paidTotalCents !== undefined || item.taxMode === "internal" ? " incl. tax" : " before tax"}
                    {!!item.discountCents && ` · $${(item.discountCents / 100).toFixed(2)} discount`}
                    {" · "}
                    {item.status}
                  </p>
                </div>
                {item.status === "pending" &&
                  item.provider === "mock" &&
                  data.mock && (
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => {
                        setOrder(item);
                        setOpen(true);
                      }}
                    >
                      Continue test checkout
                    </button>
                  )}
                {item.provider === "paddle" &&
                  data.checkout.provider === "paddle" &&
                  item.status === "pending" && (
                    <div className="billing-order-actions">
                      {item.paddleTransactionId &&
                        currentPackPrice(item) && (
                          <button
                            className="button button-secondary"
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              void openPaddle(item).catch((cause: unknown) =>
                                setError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Checkout couldn’t open.",
                                ),
                              );
                            }}
                          >
                            Continue checkout
                          </button>
                        )}
                      {!currentPackPrice(item) && (
                        <span>
                          Earlier pricing. Choose a pack above for a new checkout.
                        </span>
                      )}
                      <button
                        className="billing-text-button"
                        disabled={busy}
                        onClick={() => void verifyPayment(item)}
                      >
                        Check payment
                      </button>
                    </div>
                  )}
                {data.mock &&
                  item.provider === "mock" &&
                  item.status === "paid" && (
                    <button
                      className="billing-text-button"
                      disabled={busy}
                      onClick={() => void simulate("refund", item)}
                    >
                      Refund unused pack
                    </button>
                  )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No purchases yet.</p>
        )}
      </section>
      <section className="workspace-panel billing-history">
        <h2>Credit activity</h2>
        <p>
          Reservations are temporary holds. Returned credits become available
          again.
        </p>
        {data.ledger.length ? (
          <ul>
            {data.ledger.map((item) => (
              <li key={item._id}>
                <div>
                  <strong>{item.description}</strong>
                  <p>
                    {date(item.createdAt)} UTC
                    {item.reference.match(/^[a-f\d]{24}$/i) && (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/dashboard/videos/${item.reference}`}>
                          Open video
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="billing-delta">
                  <strong>
                    {item.availableDelta > 0 ? "+" : ""}
                    {number(item.availableDelta / 60)} available
                  </strong>
                  {item.reservedDelta !== 0 && (
                    <span>
                      {item.reservedDelta > 0 ? "+" : ""}
                      {number(item.reservedDelta / 60)} reserved
                    </span>
                  )}
                  {item.usedDelta !== 0 && (
                    <span>{number(item.usedDelta / 60)} used</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No credit activity yet.</p>
        )}
      </section>
      <Dialog open={confirming} onClose={() => {}} className="billing-dialog">
        <div className="billing-dialog-backdrop" aria-hidden="true" />
        <div className="billing-dialog-position">
          <DialogPanel className="billing-dialog-panel">
            <LoaderCircle size={32} className="loading-spinner" aria-hidden="true" />
            <DialogTitle tabIndex={-1} data-autofocus>
              Confirming your payment
            </DialogTitle>
            <Description>
              We’re checking your purchase with Paddle. Your credits will appear
              as soon as it’s confirmed.
            </Description>
          </DialogPanel>
        </div>
      </Dialog>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            void refresh().catch(() => undefined);
          }
        }}
        className="billing-dialog"
      >
        <div className="billing-dialog-backdrop" aria-hidden="true" />
        <div className="billing-dialog-position">
          <DialogPanel className="billing-dialog-panel">
            <button
              className="billing-dialog-close"
              aria-label="Close checkout"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              <X size={24} />
            </button>
            <FlaskConical size={30} aria-hidden="true" />
            <DialogTitle>Test checkout</DialogTitle>
            <Description>No card needed. No money will be taken.</Description>
            {order && (
              <>
                <div className="billing-checkout-total">
                  <Coins size={24} aria-hidden="true" />
                  <div>
                    <strong>
                      {order.packName} · {order.credits} credits
                    </strong>
                    <p>
                      ${(order.priceCents / 100).toFixed(2)} USD · one time
                      {order.taxMode === "internal" ? " · tax included" : " · before tax"}
                    </p>
                  </div>
                </div>
                <p className="billing-help">
                  {order.status === "pending"
                    ? "Choose an outcome to test payment handling. Test credits can be used for real processing in this development environment."
                    : `Payment ${order.status}.`}
                </p>
                {error && (
                  <p role="alert" className="form-alert">
                    {error}
                  </p>
                )}
                {order.status === "pending" ? (
                  <div className="billing-checkout-actions">
                    <button
                      className="button button-primary"
                      disabled={busy}
                      onClick={() => void simulate("success")}
                    >
                      {busy ? "Processing…" : "Simulate successful payment"}
                    </button>
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => void simulate("failure")}
                    >
                      Simulate declined payment
                    </button>
                    <button
                      className="billing-text-button"
                      disabled={busy}
                      onClick={() => void simulate("cancel")}
                    >
                      Cancel checkout
                    </button>
                  </div>
                ) : (
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => setOpen(false)}
                  >
                    Done
                  </button>
                )}
              </>
            )}
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
