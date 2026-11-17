import type { Metadata } from "next";
import { requireUser } from "@/lib/server-api";
import { SettingsForms } from "@/components/dashboard/settings-forms";

export const metadata: Metadata = { title: "Account settings — Clipvelto" };
export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <div className="dashboard-page-heading">
        <div>
          <h1>Account settings</h1>
          <p>Your details. Your security. All in one place.</p>
        </div>
      </div>
      <SettingsForms user={user} />
    </>
  );
}
