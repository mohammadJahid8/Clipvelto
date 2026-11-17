import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Editorial pages do not read cookies or depend on the API to render.
// The shared header resolves the account session on the client.
export function ContentShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="content-main">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
