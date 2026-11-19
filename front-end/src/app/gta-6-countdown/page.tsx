import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Gamepad2, ExternalLink, Check, Scissors } from "lucide-react";
import { ContentShell } from "@/components/content/content-shell";
import { GtaCountdown, GtaRegionalTimes } from "@/components/content/gta-countdown";
import { StructuredData } from "@/components/content/structured-data";
import { absoluteUrl, breadcrumbData, publicMetadata } from "@/lib/seo";
import { gtaRelease } from "@/lib/gta-release";
import "@/styles/gta-countdown.css";

const baseMetadata = publicMetadata({
  title: "GTA 6 countdown: release date and local launch times",
  description: "Count down to GTA 6’s November 19, 2026 midnight release in your region. See live regional timers, official Rockstar screenshots and launch-day guides.",
  path: "/gta-6-countdown",
});
const socialImage = { url: absoluteUrl("/blog/gta-6-jason-lucia.jpg"), width: 1920, height: 1080, alt: "Jason and Lucia in Grand Theft Auto VI. © Rockstar Games." };
export const metadata: Metadata = {
  ...baseMetadata,
  openGraph: { ...baseMetadata.openGraph, images: [socialImage] },
  twitter: { ...baseMetadata.twitter, card: "summary_large_image", images: [socialImage.url] },
};

const guides = [
  { href: "/blog/gta-6-download-size-storage-preload", title: "Get your console ready", text: "Storage, downloads and pre-load preparation.", image: "/blog/gta-6-jason-driving.jpg", alt: "Jason behind the wheel of a car in GTA VI." },
  { href: "/blog/gta-6-vice-city-leonida-locations", title: "Your first look at Leonida", text: "Vice City, the Keys and the places beyond.", image: "/blog/gta-6-leonida-keys.jpg", alt: "An aircraft above the islands and blue water of Leonida Keys in GTA VI." },
  { href: "/blog/gta-6-vehicles-cars-bikes-aircraft", title: "Meet your next getaway", text: "Cars, motorcycles and aircraft in Rockstar’s imagery.", image: "/blog/gta-6-jason-motorcycle.jpg", alt: "Jason beside a motorcycle beneath palm trees in GTA VI." },
];

export default function GtaCountdownPage() {
  return (
    <ContentShell>
      <StructuredData data={breadcrumbData([{ name: "Home", path: "/" }, { name: "GTA 6 countdown", path: "/gta-6-countdown" }])} />
      <StructuredData data={{ "@context": "https://schema.org", "@type": "WebPage", name: "GTA 6 release countdown", url: absoluteUrl("/gta-6-countdown"), description: baseMetadata.description, dateModified: "2026-11-19", image: socialImage.url, citation: gtaRelease.source }} />
      <div className="gta-countdown-page">
        <section className="gta-hero" aria-labelledby="gta-countdown-title">
          <Image src="/blog/gta-6-vice-city-waterfront.jpg" alt="Rockstar’s official GTA VI screenshot of a sunlit Vice City beachfront from a balcony." fill sizes="100vw" preload className="gta-hero-image" />
          <div className="gta-hero-shade" />
          <div className="container gta-hero-inner">
            <nav className="gta-breadcrumb" aria-label="Breadcrumb"><Link href="/">Clipvelto</Link><ArrowRight size={14} aria-hidden="true" /><span>GTA 6 countdown</span></nav>
            <div className="gta-hero-content">
              <p className="gta-release-line"><CalendarDays size={17} aria-hidden="true" /> 19 November 2026 <span aria-hidden="true">·</span> <Gamepad2 size={18} aria-hidden="true" /> PS5 & Xbox Series X|S</p>
              <h1 id="gta-countdown-title"><span>GTA 6.</span>Launch countdown.</h1>
              <p className="gta-hero-description">The road back to Vice City starts at midnight. Find out when Leonida opens in your region.</p>
              <GtaCountdown />
            </div>
          </div>
        </section>
        <div className="container gta-image-credit"><span>Official GTA VI imagery. © Rockstar Games.</span><a href={gtaRelease.screenshots} target="_blank" rel="noopener noreferrer">Image source <ExternalLink size={14} aria-hidden="true" /></a></div>

        <section id="release-times" className="container gta-section" aria-labelledby="gta-times-title">
          <div className="gta-section-heading"><div><h2 id="gta-times-title">One launch. Around the world.</h2><p>Rockstar confirms midnight local time on 19 November for PS5 and Xbox Series X|S. Some regions have already reached release time. Choose a region below to open its countdown.</p></div><a className="content-text-link" href={gtaRelease.source} target="_blank" rel="noopener noreferrer">Official release schedule <ExternalLink size={16} aria-hidden="true" /></a></div>
          <GtaRegionalTimes />
          <p className="gta-schedule-note">Match the countdown to your console’s store region. Your console’s own unlock timer is the final check. This page tracks scheduled release times, not live server availability.</p>
        </section>

        <section className="container gta-section gta-leonida" aria-labelledby="gta-leonida-title">
          <figure><Image src="/blog/gta-6-vice-city.jpg" alt="An airplane above the illuminated Vice City sign at sunset in GTA VI." width={1920} height={1080} sizes="(max-width: 800px) 100vw, 55vw" /><figcaption>Vice City at dusk. © Rockstar Games. <a href={gtaRelease.screenshots} target="_blank" rel="noopener noreferrer">Source <ExternalLink size={13} aria-hidden="true" /></a></figcaption></figure>
          <div><h2 id="gta-leonida-title">Before you hit the streets.</h2><p>A little preparation now. More time in Leonida later.</p><ul><li><Check size={18} aria-hidden="true" /><span>Check the game is installed and any available updates are finished.</span></li><li><Check size={18} aria-hidden="true" /><span>Use the account and store region associated with your copy.</span></li><li><Check size={18} aria-hidden="true" /><span>Making a launch video? Check your recording and microphone before you begin.</span></li></ul><a href="https://www.rockstargames.com/VI" className="content-text-link" target="_blank" rel="noopener noreferrer">Visit the official GTA VI site <ArrowUpRight size={18} aria-hidden="true" /></a></div>
        </section>

        <section className="container gta-section" aria-labelledby="gta-guides-title"><div className="gta-section-heading"><div><h2 id="gta-guides-title">While you wait.</h2><p>Get to know the world you’re about to step into.</p></div><Link className="content-text-link" href="/blog/topics/gaming#top">All GTA 6 guides <ArrowRight size={18} aria-hidden="true" /></Link></div><div className="gta-guides">{guides.map((guide) => <Link className="gta-guide" key={guide.href} href={`${guide.href}#top`}><div className="gta-guide-image"><Image src={guide.image} alt={guide.alt} width={960} height={540} sizes="(max-width: 700px) 100vw, 33vw" /></div><div><h3>{guide.title}<ArrowUpRight size={20} aria-hidden="true" /></h3><p>{guide.text}</p><span>Official imagery © Rockstar Games</span></div></Link>)}</div></section>

        <section className="container gta-section"><div className="gta-creator"><div className="gta-creator-icon"><Scissors size={28} aria-hidden="true" /></div><div><h2>Your first session. Your best moments.</h2><p>Turn your own gameplay recordings into Shorts with Clipvelto.</p></div><Link href="/#start" className="button button-primary">Try a free clip <ArrowUpRight size={18} aria-hidden="true" /></Link></div><p className="gta-disclaimer">An independent countdown by Clipvelto, not affiliated with Rockstar Games or Take-Two Interactive. Grand Theft Auto VI and all game imagery belong to their respective owners. Release information checked 19 November 2026.</p></section>
      </div>
    </ContentShell>
  );
}
