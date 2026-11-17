import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { TrialSection } from "@/components/landing/trial-section";
import { optionalUser } from "@/lib/server-api";
import { BlogHighlights } from "@/components/content/blog-highlights";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Turn long videos into short clips",
  description:
    "Find highlights in your YouTube recordings and video uploads. Create vertical, square or horizontal MP4 clips with optional captions. Start with 15 free credits.",
  path: "/",
});

export default async function HomePage() {
  const user = await optionalUser();
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader initialSignedIn={!!user} />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <TrialSection initialSignedIn={!!user} />
        <Features />
        <HowItWorks />
        <Pricing signedIn={!!user} />
        <BlogHighlights />
      </main>
      <SiteFooter />
    </>
  );
}
