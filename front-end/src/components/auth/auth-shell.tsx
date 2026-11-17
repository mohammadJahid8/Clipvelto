import Link from "next/link";
import { ArrowLeft, Check, Scissors } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { ThemeMenu } from "@/components/ui/theme-menu";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Brand />
        <ThemeMenu />
      </header>
      <main id="main-content" className="auth-grid">
        <aside className="auth-story" aria-label="About your Clipvelto account">
          <div className="auth-story-icon">
            <Scissors size={28} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h2>
            A home for your
            <br />
            next great moment.
          </h2>
          <p>
            Start with your account. Build your creative rhythm as Clipvelto
            takes shape.
          </p>
          <ul>
            <li>
              <Check size={17} aria-hidden="true" />
              Your own creator workspace
            </li>
            <li>
              <Check size={17} aria-hidden="true" />A secure, verified account
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              More creative tools on the way
            </li>
          </ul>
          <div className="auth-phase-note">
            Your free account includes 15 source-video minutes, private uploads
            and high-quality clip downloads.
          </div>
        </aside>
        <div className="auth-form-column">
          <div className="auth-form-card">{children}</div>
          <Link href="/" className="auth-back">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Clipvelto
          </Link>
        </div>
      </main>
      <footer className="auth-footer">
        Good moments deserve another play.
      </footer>
    </div>
  );
}
