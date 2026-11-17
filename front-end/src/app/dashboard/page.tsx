import { Film, Layers, Timer, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { requireUser, getDashboard, getVideos, getBilling } from "@/lib/server-api";
import { UploadVideoButton } from "@/components/dashboard/upload-video-button";
import { VideoList } from "@/components/dashboard/video-list";
import { PurchaseNotice } from "@/components/billing/purchase-notice";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string | string[] }>;
}) {
  const { purchase } = await searchParams;
  const purchaseId =
    typeof purchase === "string" && /^paddle_[a-f0-9-]{36}$/.test(purchase)
      ? purchase
      : null;
  const [user, summary, recent, billing] = await Promise.all([
    requireUser(),
    getDashboard(),
    getVideos(undefined, 5),
    purchaseId ? getBilling() : Promise.resolve(null),
  ]);
  // The URL only identifies a purchase. Its status, owner and credits come
  // from the authenticated API, never from browser-provided payment details.
  const paidOrder = billing?.orders.find(
    (item) =>
      item._id === purchaseId &&
      item.provider === "paddle" &&
      item.status === "paid",
  );
  return (
    <>
      {purchaseId && (
        <PurchaseNotice
          orderId={purchaseId}
          credits={paidOrder?.credits}
          test={paidOrder?.mode === "test"}
        />
      )}
      <div className="dashboard-page-heading">
        <div>
          <h1>Welcome, {user.name.split(" ")[0]}.</h1>
          <p>Upload a video or import a YouTube link to create clips.</p>
        </div>
        <UploadVideoButton />
      </div>
      <section
        className="dashboard-stats"
        aria-label="Your workspace at a glance"
      >
        <article className="stat-card">
          <div>
            <span>Your videos</span>
            <Film size={19} aria-hidden="true" />
          </div>
          <strong>{summary.videos}</strong>
          <p>Uploaded and imported videos</p>
        </article>
        <article className="stat-card">
          <div>
            <span>In progress</span>
            <Timer size={19} aria-hidden="true" />
          </div>
          <strong>{summary.processing}</strong>
          <p>Videos being processed</p>
        </article>
        <article className="stat-card">
          <div>
            <span>Available credits</span>
            <Layers size={19} aria-hidden="true" />
          </div>
          <strong>
            {summary.credits.status === "unlimited"
              ? "Unlimited"
              : Number((summary.credits.available ?? 0).toFixed(2))}
          </strong>
          <p>
            {summary.credits.status === "unlimited"
              ? "No credit limit for administrators"
              : `${Number(summary.credits.reserved.toFixed(2))} reserved · ${Number(summary.credits.used.toFixed(2))} used`}
          </p>
        </article>
      </section>
      <section className="workspace-panel">
        <div className="panel-heading">
          <div>
            <h2>Your recent videos</h2>
          </div>
          <Link href="/dashboard/videos">
            View all videos <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <VideoList compact videos={recent.videos} />
      </section>
    </>
  );
}
