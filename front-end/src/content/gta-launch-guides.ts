import type { Article } from "./articles";
import { gtaCover, gtaMedia } from "./gta-media";

const published = "2026-11-17T12:20:02Z";
const official = {
  label: "Rockstar Games: GTA VI official platform listing",
  href: "https://www.rockstargames.com/VI",
};
const installation = {
  label: "Rockstar Support: GTA VI installation requirements",
  href: "https://support.rockstargames.com/articles/M6h7B5fJZMwG1dnzQkt4Z/grand-theft-auto-vi-installation-requirements",
};
const playstation = {
  label: "PlayStation: GTA VI editions, pre-load and setup support",
  href: "https://www.playstation.com/en-gb/support/games/gta-vi-support/",
};
const store = {
  label: "Rockstar Store: GTA VI editions and code-in-box information",
  href: "https://store.rockstargames.com/game/buy-gta-vi",
};
const announcement = {
  label: "Take-Two: official GTA VI pre-order and edition announcement",
  href: "https://ir.take2games.com/node/32311/pdf",
};

export const gtaLaunchGuides: Article[] = [
  {
    slug: "gta-6-system-requirements-pc-console",
    title: "GTA 6 system requirements: consoles, storage and PC status",
    description:
      "Which hardware is GTA 6 announced for? Check the confirmed console platforms, storage requirement and what the official sources say about PC specifications.",
    category: "GTA 6 setup",
    topic: "gaming",
    published,
    modified: published,
    ...gtaCover(gtaMedia.motorcycle),
    intro:
      "The useful answer to ‘Can my setup run GTA 6?’ starts with the platform, not a guessed graphics-card list. Rockstar’s current native-platform listing names PlayStation 5 and Xbox Series X|S. Its installation support page gives a console storage figure. Here is what those details mean when you are getting ready to play.",
    takeaways: [
      "The announced native platforms checked for this guide are PS5 and Xbox Series X|S.",
      "Rockstar lists up to 212 GB of available storage, depending on the device.",
      "The official sources checked on November 17 do not publish a PC release or PC CPU, GPU and RAM requirements.",
    ],
    sections: [
      {
        id: "supported-hardware",
        title: "Which consoles are listed?",
        paragraphs: [
          "Rockstar’s GTA VI page lists PlayStation 5 and Xbox Series X|S. If you own one of those systems, the practical checks are your platform-specific copy, available storage and the installation status shown on the console. You do not choose a separate CPU or RAM configuration for a console game.",
          "PS4 and Xbox One are not listed there as native-install platforms. Do not confuse the name Xbox Series X|S with Xbox One, or assume that a console manufacturer’s logo confirms every generation of its hardware. Cloud access, if offered separately, is a different question from installing a native version.",
        ],
        table: {
          headings: [
            "Setup question",
            "What the checked official sources establish",
          ],
          rows: [
            ["PlayStation 5", "Listed as an announced platform"],
            ["Xbox Series X and Series S", "Listed as announced platforms"],
            [
              "PC minimum and recommended specifications",
              "No specification table published in the sources checked",
            ],
            [
              "Console storage",
              "Up to 212 GB available space, depending on device",
            ],
          ],
        },
        links: [official, installation],
      },
      {
        id: "pc-specs",
        title: "Are GTA 6 PC requirements available?",
        paragraphs: [
          "The official pages reviewed for this article do not announce a PC version or provide a GTA VI PC requirements table. That means this guide cannot give you an official minimum graphics card, processor, RAM amount or Windows version. The review date matters: a later Rockstar announcement should replace this information when one exists.",
          "A predicted build is an estimate, even when its components look plausible. It cannot tell you how a future PC release will perform at a particular resolution or setting. If GTA 6 is the reason for a hardware purchase, wait for a platform announcement, published requirements and relevant performance evidence rather than treating a speculative parts list as a compatibility check.",
        ],
        image: gtaMedia.driving,
      },
      {
        id: "storage",
        title: "Storage is the requirement you can check now",
        paragraphs: [
          "Rockstar Support currently says the console game requires up to 212 GB of available space, depending on the device. Use the current installer’s own requirement as the final check. This is available installation space, not the amount of RAM in your console, and it is not a promise that every future update will have the same size.",
          "Open the console’s storage management before starting. Make room by reviewing installed games and captures you no longer need, while handling saved progress separately. If you use an additional storage device, check that your console supports running the relevant native game from it; having room to store a file is not always the same as having a supported place to play it.",
        ],
        links: [
          {
            label: "Plan storage and download time",
            href: "/blog/gta-6-download-size-storage-preload",
          },
        ],
      },
      {
        id: "performance",
        title: "Compatibility and picture quality are different questions",
        paragraphs: [
          "A supported platform listing tells you where the game is offered. It does not, by itself, describe every graphics mode, display setting or performance result. Keep a frame-rate claim separate from a supported-console claim, and check any quoted target against a current platform or Rockstar source.",
          "Your display setup matters too. Before launch, confirm that the console’s output is working correctly with your screen and that the image fits without unwanted overscan or borders. Do not buy a new display solely because an unofficial chart promises a particular GTA VI mode.",
        ],
        image: gtaMedia.lucia,
      },
      {
        id: "setup-list",
        title: "A short setup checklist",
        paragraphs: [
          "The preparation that helps most is straightforward: make sure you have the correct version, enough supported storage and a completed installation. Then use the game and console’s actual settings rather than applying a PC tuning guide written before a PC release has been announced.",
        ],
        items: [
          "Confirm the platform attached to your purchase and the account that owns it.",
          "Check the current free-space requirement on the device itself.",
          "Finish the download, installation and any available update before your planned session.",
          "Check the controller, display and sound with a short session before changing several settings at once.",
        ],
        links: [playstation],
      },
    ],
    sources: [official, installation, playstation],
  },
  {
    slug: "gta-6-download-size-storage-preload",
    title: "GTA 6 download size and storage: what to prepare before launch",
    description:
      "Rockstar lists up to 212 GB of available console storage. Understand installation space, pre-load status and a realistic way to estimate a large download.",
    category: "GTA 6 setup",
    topic: "gaming",
    published,
    modified: published,
    ...gtaCover(gtaMedia.sign),
    intro:
      "A large game has more than one size to think about: the transfer over your connection, the installed files and the room an update may need. Rockstar’s support guidance currently asks for up to 212 GB of available console storage, depending on the device. Start with that requirement, then check the size and progress your own console reports.",
    takeaways: [
      "Treat the published 212 GB figure as available-space guidance; check your device’s current installer too.",
      "Download speed, installation and any update all affect when a pre-load is actually ready.",
      "The transfer-time table below is a 200 GB example, not a measured GTA VI download benchmark.",
    ],
    sections: [
      {
        id: "space-required",
        title: "How much space does GTA 6 need?",
        paragraphs: [
          "Rockstar Support’s installation article states that GTA VI requires up to 212 GB of available space depending on the device. PlayStation’s support page also tells PS5 users to have 212 GB available. Those are the official figures checked on November 17, 2026.",
          "Do not treat a small placeholder download, an early store entry or another player’s screenshot as the final requirement for your own device. Packages and updates can change. The console’s current installation prompt is the relevant check when you actually start or resume the install.",
        ],
        links: [installation, playstation],
      },
      {
        id: "three-sizes",
        title: "Download size, installed size and free space are different",
        paragraphs: [
          "The download is the data transferred to your device. Installation prepares the files that will be used by the game. Available-space guidance describes how much free room the platform asks you to provide. Those figures do not have to be identical, so a transfer total should not be used to overrule an installation prompt.",
          "Likewise, buying a drive advertised with a particular capacity does not mean that entire number is currently free for this game. Existing files and system use matter. Check the usable free space shown by the console instead of planning only around the number printed on a storage box.",
        ],
        image: gtaMedia.skyline,
      },
      {
        id: "download-time",
        title: "How long could a large download take?",
        paragraphs: [
          "For a rough estimate, multiply the transfer size in decimal gigabytes by 8,000 and divide by the sustained speed in megabits per second. The result is seconds. Use an observed download speed when you can; an internet plan’s headline maximum is not a measurement of the console’s transfer.",
          "The table is an idealized 200 GB transfer example. It does not assert that GTA VI’s exact download is 200 GB, and it excludes installation, updates, connection interruptions and protocol overhead. Actual completion will usually be longer.",
        ],
        table: {
          headings: [
            "Sustained transfer speed",
            "Ideal time for a 200 GB transfer",
          ],
          rows: [
            ["50 Mbps", "About 8 hours 53 minutes"],
            ["100 Mbps", "About 4 hours 27 minutes"],
            ["200 Mbps", "About 2 hours 13 minutes"],
            ["500 Mbps", "About 53 minutes"],
            ["1,000 Mbps", "About 27 minutes"],
          ],
        },
      },
      {
        id: "make-room",
        title: "Make room without rushing your storage cleanup",
        paragraphs: [
          "Review the largest installed games and captures first. Decide what you can re-download later and what you need to keep. Use the console’s storage tools, and read the choice you are confirming before deleting anything. Saved progress and a game installation should be considered separately.",
          "If you move existing content, confirm that the transfer completed before relying on the new free-space figure. Keep some flexibility for later updates rather than organizing the device so tightly that every additional download requires another cleanup.",
        ],
        image: gtaMedia.keys,
      },
      {
        id: "preload-ready",
        title: "Check that the pre-load is more than a queued task",
        paragraphs: [
          "PlayStation’s current GTA VI support page lists November 10 as the PS5 pre-load start and November 19 as the local-midnight release date. A pre-load lets files arrive before release; it does not mean the game unlocks as soon as the transfer finishes.",
          "Before your planned session, check that the console is still downloading, has finished installing or is waiting for an update. Confirm that background power and connection settings match the way you expect to download. If a purchase or code is missing, use the retailer or platform support route rather than repeatedly starting a different version of the game.",
        ],
        links: [
          playstation,
          {
            label: "Check platform and PC-requirement status",
            href: "/blog/gta-6-system-requirements-pc-console",
          },
        ],
      },
    ],
    sources: [installation, playstation],
  },
  {
    slug: "gta-6-standard-ultimate-edition-differences",
    title: "GTA 6 Standard vs Ultimate: editions, bonuses and code-in-box",
    description:
      "Compare Rockstar’s announced GTA 6 editions, understand the bonus categories, and check what a code-in-box purchase actually includes before buying.",
    category: "GTA 6 buying guide",
    topic: "gaming",
    published,
    modified: published,
    ...gtaCover(gtaMedia.vault),
    intro:
      "Edition names, pre-order extras and a physical box answer different buying questions. Start with the platform and the way you will receive the game, then compare the additional content. Here is a practical reading of Rockstar’s announcements and store information, checked before the November 19 launch.",
    takeaways: [
      "Rockstar announced Standard and Ultimate editions, with US announcement prices of $79.99 and $99.99.",
      "The described code-in-box version contains a download code rather than a game disc.",
      "Check regional pricing, bonus eligibility and the exact platform listing before paying.",
    ],
    sections: [
      {
        id: "edition-basics",
        title: "Start with the two announced editions",
        paragraphs: [
          "Take-Two’s June 24 announcement lists the game at $79.99 and the Ultimate Edition at $99.99. It describes Ultimate as adding a collection of vehicles, weapons, clothing and further story-related content. Those are the announcement’s US dollar figures, not a guarantee of your region’s current checkout total.",
          "That makes the announced difference $20. Compare that difference with the extras you actually want, rather than assuming the more expensive edition is necessary to begin the main game. Taxes, currencies, retailer offers and platform availability can affect what you see at checkout.",
        ],
        table: {
          headings: ["Comparison", "Standard", "Ultimate"],
          rows: [
            ["Announced US price", "$79.99", "$99.99"],
            ["Base game", "Included", "Included"],
            [
              "Additional edition content",
              "Check the current Standard listing",
              "Announced extra vehicles, weapons, apparel and story-related content",
            ],
            [
              "Final local price",
              "Check the chosen storefront",
              "Check the chosen storefront",
            ],
          ],
        },
        links: [announcement, store],
      },
      {
        id: "extra-content",
        title: "Read the extras as a list of specific entitlements",
        paragraphs: [
          "The store’s edition comparison is the place to check the actual named extras and any eligibility notes. Decide which items are important to you and whether their description tells you enough to value them. A promotional screenshot is not proof that every item pictured belongs exclusively to one edition.",
          "If the listing distinguishes a base product, an upgrade and a temporary bonus, treat them as separate lines. That helps prevent accidentally buying an upgrade without the required base game, or paying twice for content attached to the same account.",
        ],
        image: gtaMedia.motorcycle,
        links: [store],
      },
      {
        id: "box-or-disc",
        title: "A physical box does not necessarily contain a disc",
        paragraphs: [
          "Rockstar’s store and PlayStation’s support page describe the GTA VI physical code-in-box version as containing a download code, with no disc included. A box on the shelf therefore does not remove the need to redeem and download that version.",
          "Before buying, read the exact retailer’s format and region information. Think about the account on which the code will be redeemed and the internet connection you will use. If owning a disc is the reason you are selecting a physical product, the words ‘code-in-box’ are an important distinction.",
        ],
        links: [store, playstation],
      },
      {
        id: "bonuses",
        title: "Separate launch bonuses from the edition itself",
        paragraphs: [
          "The official announcement attaches the Vintage Vice City Pack to eligible pre-orders and purchases before November 20, 2026. It also describes a free month of GTA+ for digital pre-orders. Check the current terms and redemption conditions on your platform; a dated launch offer is different from the permanent contents of an edition.",
          "In particular, do not count a benefit in another GTA title as an announced GTA VI multiplayer mode. Read where each benefit applies. If a subscription is involved, review its own activation and renewal terms before treating a promotional month as an ongoing free service.",
        ],
        image: gtaMedia.balcony,
        links: [announcement],
      },
      {
        id: "upgrade",
        title: "Check the upgrade route before paying twice",
        paragraphs: [
          "PlayStation’s support page says an upgrade from digital Standard or code-in-box Standard to Ultimate is available through PlayStation Store. That establishes a PlayStation upgrade route; it should not be stretched into a promise about another platform’s pricing or entitlements.",
          "Make your final comparison on the platform you will use: the exact game, format, edition, account and local total. Save the order confirmation so you can check what you purchased if an entitlement does not appear as expected.",
        ],
        links: [
          playstation,
          {
            label: "Plan space for the download",
            href: "/blog/gta-6-download-size-storage-preload",
          },
        ],
      },
    ],
    sources: [announcement, store, playstation],
  },
];
