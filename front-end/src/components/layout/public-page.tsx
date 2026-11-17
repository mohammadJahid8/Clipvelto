import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { optionalUser } from "@/lib/server-api";

export async function PublicPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated?: string;
  children: ReactNode;
}) {
  const user = await optionalUser();
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader initialSignedIn={!!user} />
      <main id="main-content" tabIndex={-1} className="container public-page">
        <header className="public-page-heading">
          <Link href="/" className="public-back">
            <ArrowLeft size={17} aria-hidden="true" />
            Back to home
          </Link>
          <h1>{title}</h1>
          <p>{intro}</p>
          {updated && <p className="public-updated">Last updated: {updated}</p>}
        </header>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
