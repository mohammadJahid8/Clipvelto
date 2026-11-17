"use client";

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  Film,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { User } from "@/lib/server-api";
import { authClient } from "@/lib/auth-client";
import { Brand } from "@/components/ui/brand";
import { ThemeMenu } from "@/components/ui/theme-menu";
import { UserAvatar } from "@/components/ui/user-avatar";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/upload", label: "Upload video", icon: Upload },
  { href: "/dashboard/videos", label: "My videos", icon: Film },
  { href: "/dashboard/billing", label: "Credits & billing", icon: CreditCard },
  { href: "/dashboard/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function Navigation({
  isAdmin,
  close,
}: {
  isAdmin: boolean;
  close?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={
        close ? "Mobile workspace navigation" : "Workspace navigation"
      }
      className="workspace-navigation"
    >
      {links
        .filter((link) => !link.adminOnly || isAdmin)
        .map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={
              pathname === href ||
              (href === "/dashboard/videos" &&
                pathname.startsWith("/dashboard/videos/"))
                ? "page"
                : undefined
            }
            onClick={close}
          >
            <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            {label}
          </Link>
        ))}
    </nav>
  );
}

export function DashboardShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const session = authClient.useSession();
  const switchedAccount =
    !session.isPending && !session.error && session.data?.user.id !== user.id;
  useEffect(() => {
    if (switchedAccount)
      window.location.replace(session.data?.user ? "/dashboard" : "/sign-in");
  }, [switchedAccount, session.data?.user.id]);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("We couldn’t sign you out. Please try again.");
        return;
      }
      window.location.replace("/sign-in");
    } catch {
      setError("We couldn’t connect. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }
  if (switchedAccount)
    return (
      <main className="workspace-session-update" role="status">
        Updating your workspace…
      </main>
    );
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      <aside className="workspace-sidebar">
        <Brand />
        <Navigation isAdmin={user.role === "admin"} />
        <div className="sidebar-note">
          <Link href="/">
            Visit the website <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="sidebar-user">
          <UserAvatar name={user.name} image={user.image} />
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <Disclosure as="header" className="workspace-header">
          {({ open, close }) => (
            <>
              <div className="workspace-topbar">
                <div className="workspace-mobile-brand">
                  <Brand />
                </div>
                <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
                  <Link href="/dashboard">Workspace</Link>
                  <ChevronRight size={16} aria-hidden="true" />
                  <span aria-current="page">
                    {links.find((link) => link.href === pathname)?.label ??
                      (pathname.startsWith("/dashboard/videos/")
                        ? "Video details"
                        : "Overview")}
                  </span>
                </nav>
                <div className="workspace-header-actions">
                  <ThemeMenu />
                  <button
                    className="sign-out-button"
                    disabled={signingOut}
                    aria-busy={signingOut}
                    onClick={signOut}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>{signingOut ? "Signing out…" : "Sign out"}</span>
                  </button>
                  <DisclosureButton
                    className="icon-button workspace-menu-button"
                    aria-label={
                      open
                        ? "Close workspace navigation"
                        : "Open workspace navigation"
                    }
                  >
                    {open ? <X size={21} /> : <Menu size={21} />}
                  </DisclosureButton>
                </div>
              </div>
              <DisclosurePanel className="workspace-mobile-navigation">
                <div className="workspace-mobile-user">
                  <UserAvatar name={user.name} image={user.image} />
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                </div>
                <Navigation
                  isAdmin={user.role === "admin"}
                  close={() => close()}
                />
              </DisclosurePanel>
            </>
          )}
        </Disclosure>
        {error && (
          <p className="form-alert workspace-error" role="alert">
            {error}
          </p>
        )}
        <main
          id="workspace-content"
          tabIndex={-1}
          className="workspace-content"
        >
          {children}
        </main>
        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} Clipvelto</span>
        </footer>
      </div>
    </div>
  );
}
