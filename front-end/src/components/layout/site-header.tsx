"use client";

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { ThemeMenu } from "@/components/ui/theme-menu";
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { AccountDialog } from "@/components/auth/account-dialog";

export function SiteHeader({
  initialSignedIn = false,
}: {
  initialSignedIn?: boolean;
}) {
  const session = authClient.useSession();
  const signedIn = session.isPending ? initialSignedIn : !!session.data;
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [oauthError, setOauthError] = useState<string>();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("auth") !== "google") return;
    setOauthError(url.searchParams.get("error") ?? "unknown");
    setAuthMode("sign-in");
    setAuthOpen(true);
    for (const key of ["auth", "error", "error_description"])
      url.searchParams.delete(key);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);
  function openAuth(mode: "sign-in" | "sign-up") {
    setOauthError(undefined);
    setAuthMode(mode);
    setAuthOpen(true);
  }
  return (
    <>
      <Disclosure as="header" className="site-header">
        {({ open, close }) => (
          <>
            <div className="container navigation">
              <Brand />
              <nav className="desktop-links" aria-label="Main navigation">
                <a href="/#how-it-works">How it works</a>
                <a href="/#pricing">Pricing</a>
                <Link href="/blog">Blog</Link>
              </nav>
              <div className="nav-actions">
                <ThemeMenu />
                {!signedIn && (
                  <button
                    type="button"
                    className="nav-sign-in"
                    onClick={() => openAuth("sign-in")}
                  >
                    Sign in
                  </button>
                )}
                {signedIn ? (
                  <Link
                    className="button button-primary nav-cta"
                    href="/dashboard"
                  >
                    Dashboard <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="button button-primary nav-cta"
                    onClick={() => openAuth("sign-up")}
                  >
                    Get started <ArrowUpRight size={18} aria-hidden="true" />
                  </button>
                )}
                <DisclosureButton
                  className="icon-button mobile-menu-button"
                  aria-label={open ? "Close navigation" : "Open navigation"}
                >
                  {open ? <X size={21} /> : <Menu size={21} />}
                </DisclosureButton>
              </div>
            </div>
            <DisclosurePanel className="mobile-navigation">
              <nav className="container" aria-label="Mobile navigation">
                <a href="/#how-it-works" onClick={() => close()}>
                  How it works
                </a>
                <a href="/#pricing" onClick={() => close()}>
                  Pricing
                </a>
                <Link href="/blog" onClick={() => close()}>
                  Blog
                </Link>
                {signedIn ? (
                  <Link href="/dashboard" onClick={() => close()}>
                    Dashboard
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      openAuth("sign-up");
                    }}
                  >
                    Get started
                  </button>
                )}
                {!signedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      openAuth("sign-in");
                    }}
                  >
                    Sign in
                  </button>
                )}
              </nav>
            </DisclosurePanel>
          </>
        )}
      </Disclosure>
      <AccountDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        oauthError={oauthError}
      />
    </>
  );
}
