# Clipvelto — instructions for Codex

Build a clean, accessible, responsive video-to-shorts SaaS. Phases 1–3 are implemented. **Phase 4 and YouTube imports are now authorized**, including active-stream capture, along with signup verification-flow fixes and SMTP setup guidance. Preserve the landing page based on `design-reference/index.html` and `design-reference/assets/`.

## Rules

- Single npm workspace; Next.js frontend in `front-end/`, Express, MongoDB, and BullMQ validation worker in `back-end/`. This layout follows the latest user master prompt.
- TypeScript strict; Tailwind CSS; Headless UI for accessible interactive controls; Space Grotesk headings and DM Sans body.
- All new files and directories lowercase kebab-case, except required framework names.
- Keep components, hooks, utilities modular and reusable without premature abstractions.
- Both light and dark mode, persistent theme preference, no hydration flash, mobile-first layout.
- No tiny uppercase letter-spaced eyebrow labels, purple gradients, generic AI visuals, or excessive decorations.
- Three portrait video previews in hero: smaller left, larger raised center, smaller right. Local images are already available.
- Clear CTA, how it works, concise pricing, footer; do not target only gaming creators.
- SEO: metadata, canonical when domain known, sitemap, robots, accessible semantic HTML, good Core Web Vitals; no invented testimonials or schema claims.
- No fake working payment or video processing. Clearly mark not-yet-implemented actions.
- Test lint, typecheck, build, mobile layouts and both themes; report any checks you could not perform.

## Current phase

4. Local CPU transcription, YouTube video and completed-stream imports, bounded active-stream capture (1–10 minutes), Claude highlight selection, FFmpeg captioned vertical MP4 rendering and private downloads. Maintain one global media job and at most two inference/encoding threads. Preserve sources/transcripts on failure. Fix signup verification so the email is remembered and local capture is clearly explained. Document free Gmail SMTP testing without requiring a custom-domain mailbox.

## Newly authorized

The user authorized free credits (15 source-video minutes), a bounded anonymous YouTube trial with verified-account claiming, server-enforced limits, administrator access for their confirmed account, upload aspect/caption choices, session-aware landing navigation, and improved output quality. Use one best watermarked trial preview; unlock the remaining selected highlights after verified signup. Google sign-in is now authorized, including Google Cloud client setup; credit packs and a development-only payment simulator are now authorized; real Stripe remains out of scope. Never claim anonymous abuse prevention or preview-copy prevention is absolute.

## Later phases (do not implement yet)

5. Real Stripe only after business eligibility is confirmed; verified payment webhooks. Credit packs and simulated payments are authorized now.
6. VPS deployment is now authorized on the shared Contabo server. Invitation Maker's local workflow/Compose and live Nginx/container setup have been inspected read-only. Keep that project and its services intact.

## Landing-page reference

Preserve the implemented landing page and its local preview images, reusable components, responsive typography, and accessible light/dark/system controls. Preserve upload infrastructure, authentication security and local preview assets. Credit packs and explicitly simulated local payments are authorized. Live Paddle payments and the isolated VPS deployment are authorized as described below. Google sign-in and OTP authentication improvements are authorized.

## Current credit-system authorization

The user authorized $6/120-credit Starter, $15/360-credit Creator and $32/900-credit Studio prepaid packs with applicable taxes added at checkout and clearly disclosed beside advertised prices, additive balances without expiry, and an explicitly labeled mock checkout while Stripe is unavailable. Keep test/live wallets separate and mock mode disabled in production. Preserve immutable pricing/tax snapshots for old purchases and delayed payment events. Replace package duration/file-count/storage caps with verified source-minute/storage credit quotes. Preserve ownership, validation, resource safety and single-job concurrency. New media retention is 30 days; failed/unpaid media is kept for 24 hours. Respect the user’s explicit instruction not to run build, lint or TSC; use only focused checks needed for this change.

## Submitted-job deletion policy

Users cannot cancel submitted uploads, queued imports or processing jobs. Enforce this in the API as well as the UI. Permit owner deletion only after clips are completed and no media work is queued or running. Deleting completed videos never refunds spent credits. System failures still release reservations and preserve retry data. Retain legacy cancellation settlement only for previously requested removals.

## Paddle integration authorization

The user has now authorized Paddle integration and created live and sandbox accounts. Production live collection was enabled on 18 November 2026 after Paddle account/domain verification completed and saved payout settings were observed. Preserve test/live wallet separation and production sandbox/mock guards. The live checkout and signed webhook delivery were verified without completing a payment; do not claim a paid end-to-end test has passed. Verify raw-body webhook signatures and current Paddle transactions, bind purchases to immutable local orders, and grant credits atomically and once only. Full unused-pack refunds can be reversed automatically; partial refunds, disputes and refunds affecting used/reserved credits must hold new processing for review rather than silently exposing refunded credits. Stripe remains out of scope; deployment is authorized below. Continue respecting the instruction not to run build, lint or TSC.

## Current deployment authorization

The user authorized preparing and deploying Clipvelto using the Invitation Maker approach: GitHub Actions builds images, GHCR stores them, SSH deploys Docker Compose, and host Nginx serves HTTPS. Target repository: `mohammadJahid8/Clipvelto`; VPS: `207.244.254.33`; domain: `clipvelto.com`. Use the isolated `clipvelto` Compose project and `/var/www/clipvelto`, loopback ports 3002/4002, separate authenticated MongoDB replica set/Redis and one CPU-limited media worker. Never copy the old project's environment, change its vhosts, stop its containers, globally prune Docker images, or disable SSH host-key validation. Production uses BILLING_MODE=paddle, PADDLE_ENVIRONMENT=live and PADDLE_LIVE_ENABLED=true with separate live credentials and the active https://clipvelto.com/api/webhooks/paddle destination. Preserve those settings across deployments. Keep local sandbox configuration intact; never deploy sandbox/mock settings to production. Deployment image compilation belongs in CI; don't run local build, lint or TSC checks.

## Persistent YouTube browser pilot

The user authorized a self-hosted persistent browser experiment with Playwright, a dedicated Google account, automatic YouTube-only cookie synchronization and private operator sign-in. Keep it isolated in the `clipvelto-browser` Compose project, without application/database/payment credentials. Use a non-root sandboxed browser and bounded resources. CDP and raw VNC stay container-local; the expiring token-protected noVNC viewer is bound to VPS loopback and reached only through SSH. The owner completes Google login/challenges and confirms the dedicated account before enabling synchronization. Never automatically solve challenges, handle a new Google password, import personal cookies or expose browser access publicly. Keep imports paused until a real short download confirms recovery, and do not promise uninterrupted YouTube access.
