import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, RefreshCw, Users } from "lucide-react";
import { z } from "zod";
import { getAdminUsers } from "@/lib/server-api";
import "@/styles/admin-users.css";

export const metadata: Metadata = { title: "Users — Clipvelto" };

function ActivityDate({ value }: { value: string | null }) {
  if (!value) return <span className="admin-users-muted">Not recorded</span>;
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(new Date(value))}
    </time>
  );
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { cursor } = await searchParams;
  const parsed = z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional()
    .safeParse(cursor);
  const page = await getAdminUsers(parsed.success ? parsed.data : undefined);
  return (
    <>
      <div className="dashboard-page-heading">
        <div>
          <h1>Users</h1>
          <p>Registered accounts, recent sign-ins and credit pack purchases.</p>
        </div>
        <form action="/dashboard/users" method="get">
          <button type="submit" className="button button-secondary">
            <RefreshCw size={18} aria-hidden="true" /> Refresh
          </button>
        </form>
      </div>
      {!parsed.success && (
        <p className="form-alert" role="status">
          That page link wasn’t valid. Showing the newest users.
        </p>
      )}
      <section
        className="workspace-panel admin-users-panel"
        aria-labelledby="registered-users-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="registered-users-title">
              {page.total} registered {page.total === 1 ? "user" : "users"}
            </h2>
            <p>
              Credit packs are one-time purchases. Test purchases are labelled.
            </p>
          </div>
        </div>
        {page.users.length ? (
          <table className="admin-users-table" role="table">
            <caption className="sr-only">
              Registered users and account activity
            </caption>
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Registered</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">Package</th>
              </tr>
            </thead>
            <tbody>
              {page.users.map((user) => (
                <tr key={user.id}>
                  <td data-label="User" className="admin-users-identity">
                    <strong>{user.name || "Unnamed user"}</strong>
                    <span>{user.email}</span>
                    {!user.emailVerified && <small>Email not verified</small>}
                  </td>
                  <td data-label="Registered">
                    <ActivityDate value={user.createdAt} />
                  </td>
                  <td data-label="Last sign-in">
                    <ActivityDate value={user.lastLoginAt} />
                  </td>
                  <td data-label="Package">
                    {user.purchase ? (
                      <div className="admin-users-purchase">
                        <strong>{user.purchase.packName}</strong>
                        <span className="admin-users-badge">
                          {user.purchase.status === "review"
                            ? "Needs payment review"
                            : `${user.purchase.mode === "test" ? "Test purchase" : "Purchased"}${user.purchase.status === "refunded" ? " · refunded" : ""}`}
                        </span>
                        {user.purchase.date && (
                          <ActivityDate value={user.purchase.date} />
                        )}
                      </div>
                    ) : (
                      <span className="admin-users-muted">No purchases</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="admin-users-empty">
            <Users size={28} aria-hidden="true" />
            <p>
              {cursor
                ? "No more users on this page."
                : "No registered users yet."}
            </p>
          </div>
        )}
        <p className="admin-users-footnote">
          Times are shown in UTC. Older sign-ins may not have been recorded.
        </p>
      </section>
      {(cursor || page.nextCursor) && (
        <nav className="video-pagination" aria-label="User pages">
          <Link className="button button-secondary" href="/dashboard/users">
            <ArrowLeft size={18} aria-hidden="true" /> Newest users
          </Link>
          {page.nextCursor && (
            <Link
              className="button button-secondary"
              href={`/dashboard/users?cursor=${page.nextCursor}`}
            >
              Older users <ArrowRight size={18} aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
