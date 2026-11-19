import Link from "next/link";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { AnalyticsPreferencesButton } from "@/components/analytics/clarity-analytics";

const groups = [
  {
    title: "Product",
    links: [
      ["How it works", "/#how-it-works"],
      ["Pricing", "/#pricing"],
      ["YouTube to Shorts", "/youtube-to-shorts#top"],
      ["Podcast clip maker", "/podcast-clip-maker#top"],
    ],
  },
  {
    title: "Explore",
    links: [
      ["Blog", "/blog#top"],
      ["Gaming & GTA 6", "/blog/topics/gaming#top"],
      ["Video editing", "/blog/topics/video-editing#top"],
      ["Podcast clips", "/blog/topics/podcasts#top"],
      ["Interviews & webinars", "/blog/topics/repurposing#top"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Contact", "/contact#top"],
      ["Privacy policy", "/privacy#top"],
      ["Terms & conditions", "/terms#top"],
      ["Refund policy", "/refunds#top"],
    ],
  },
];
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand href="/#top" />
            <p>Turn long recordings into short videos worth watching.</p>
            <Link href="/#start">
              Try a free preview <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          {groups.map((group) => (
            <nav
              className="footer-column"
              key={group.title}
              aria-label={group.title}
            >
              <h2>{group.title}</h2>
              <ul>
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="footer-base">
          <p>© {new Date().getFullYear()} Clipvelto. All rights reserved.</p>
          <div className="footer-base-links">
            <AnalyticsPreferencesButton />
            <a href="#top">
              Back to top <ArrowUp size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
