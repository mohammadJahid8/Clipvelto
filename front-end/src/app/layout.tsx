import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "@/styles/billing.css";
import "@/styles/public-pages.css";
import "@/styles/editorial.css";
import { absoluteUrl, sharingImage, site } from "@/lib/seo";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const title = "Clipvelto — Turn Long Videos into Shorts";
const description =
  "Turn long videos into clips with Clipvelto. Choose vertical, horizontal or square, add optional captions, and download MP4s. Start with 15 free minutes.";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title,
  description,
  applicationName: "Clipvelto",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Clipvelto",
    locale: "en_US",
    type: "website",
    images: [sharingImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [sharingImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0f14" },
  ],
};

// Runs before the first paint; storage failure falls back to the system preference.
const themeScript = `(function(){var t='system';try{t=localStorage.getItem('clipvelto-theme')||'system'}catch(e){}var dark=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',dark?'#0c0f14':'#fafaf8')})})()`;
// Cookieless analytics; never send a fabricated cookie-consent grant.
const clarityScript = `(function(c,l,a,r,i){if(!/^(www\\.)?clipvelto\\.com$/.test(c.location.hostname))return;c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};c[a]('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});var t=l.createElement(r);t.async=true;t.src='https://www.clarity.ms/tag/'+i;l.head.appendChild(t)})(window,document,'clarity','script','zfwos3evxf');`;
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: site.name,
      url: site.url,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/logo.svg"),
        width: 64,
        height: 64,
      },
    },
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: site.name,
      url: site.url,
      description,
      publisher: { "@id": absoluteUrl("/#organization") },
      inLanguage: "en",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" id="top" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${spaceGrotesk.variable}`} data-clarity-unmask="true">
        {children}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {clarityScript}
        </Script>
      </body>
    </html>
  );
}
