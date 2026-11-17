export default function DashboardLoading() {
  return (
    <div className="dashboard-loading" role="status" aria-live="polite">
      <div className="loading-placeholder" />
      <div className="loading-placeholder" />
      <p>Opening your workspace…</p>
    </div>
  );
}
