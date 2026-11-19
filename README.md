# Clipvelto

A video-to-shorts product in development. The landing page, account/workspace foundation, private-upload infrastructure, Groq or local CPU transcription, YouTube imports, and captioned clip generation are implemented. Credits, payments, and deployment remain later phases.

## Run locally

Use Node.js 26.13.1 LTS (`nvm use`) and npm.

```sh
npm ci
npm run dev:setup
```

The setup command creates an ignored `back-end/.env` with a unique authentication secret. It preserves existing values and secrets, adding missing local-development defaults when new configuration fields are introduced. No cloud account or credentials are needed for local development.

Start the local database in one terminal:

```sh
npm run dev:database
```

This development helper downloads a pinned MongoDB 8.2.2 binary on first use and runs a real single-node replica set on `127.0.0.1:27017`. Data persists in `back-end/.local-data/mongo/`. Keep it running. It is not a production database setup. You can instead set `MONGODB_URI` in `back-end/.env` to an existing replica set or sharded cluster. A standalone MongoDB instance is deliberately rejected because authentication operations use transactions.

In a second terminal, start local Redis and S3-compatible storage:

```sh
npm run dev:uploads
```

This helper downloads and builds Redis 8.2.3 on first use (a C compiler and `make` are required on macOS/Linux). It runs Redis on loopback port 6379 with append-only persistence and `noeviction`. The S3 development emulator runs on loopback port 9000 with private signature checks and exact-origin CORS. Their data persists in `back-end/.local-data/upload-services/`. Keep both service terminals open. These helpers are strictly for local development, not VPS hosting.

When `STORAGE_ENDPOINT` points to Cloudflare R2, media goes to R2 instead of the local emulator. Keep `dev:uploads` running for Redis, which background jobs still need. Restart the API and worker after changing storage environment variables. Keep the bucket private; previews and downloads use temporary signed URLs, so no R2 public URL is required.

In a third terminal:

```sh
npm run dev
```

Open http://localhost:3000. Next.js runs on 3000, Express binds only to loopback on 4000, and the BullMQ video worker runs as a separate process inside `back-end/`. Next forwards same-origin `/api/*` requests to Express. `npm run dev:web` runs just the frontend when needed.

For the compiled version, stop the development application first, then run:

```sh
npm run build
npm start
```

MongoDB, Redis, and object storage must remain running. `next/font` downloads Space Grotesk and DM Sans during the first build and serves them locally at runtime.

## Try an account

1. Open `/sign-up` and create an account with a password of 12–128 characters.
2. Local development captures authentication emails in ignored, private files rather than sending real email. Read the latest one with:

   ```sh
   npm run mail:latest --workspace @clipvelto/api
   ```

3. Enter the emailed 6-digit code in the form to verify your account and sign in.
4. Visit `/dashboard`, `/dashboard/videos`, `/dashboard/settings`, and `/dashboard/billing`.
5. Upload an owned/authorized MP4, MOV, or WebM at `/dashboard/upload`; watch its checks at the video detail page. Source length and storage are funded by credits. Check the quote before processing; package duration, file-count and account-storage caps have been removed.
6. When transcription and clip creation are configured (see below), uploads and imports continue automatically through transcription, highlight selection and rendering. Follow the progress screen, then preview/download your clips and transcript.
7. Try password recovery from `/forgot-password`; use the same mail command to read its reset link.

Captured emails contain live development tokens. Keep `back-end/.local-data/` private and delete old captures when no longer needed. There is no web endpoint exposing the mailbox. No demo users or passwords are seeded.

## Architecture

The repository has two npm applications:

- `front-end/`: Next.js App Router, React, strict TypeScript, Tailwind, Headless UI, Lucide, React Hook Form, and Zod.
- `back-end/`: Express 5 ESM, Better Auth, MongoDB/Mongoose, Zod environment validation, Nodemailer, Pino, AWS S3 SDK, Redis/BullMQ, and a metadata-validation/transcription worker. No credit or payment implementation.

Reusable UI is under `front-end/src/components/`. Backend authentication, upload sessions, and video history are under `back-end/src/modules/`; background validation is under `back-end/src/jobs/`.

Better Auth 1.7.25 supports [Express 5](https://better-auth.com/docs/integrations/express) and its [native MongoDB adapter](https://better-auth.com/docs/adapters/mongo). Mongoose owns the database connection; the adapter shares its native MongoDB client. The root npm override aligns the compatible MongoDB 7.8 driver across Mongoose, Better Auth, and test tools, avoiding duplicate driver classes. Better Auth owns its user/account/session/verification collections; the application does not maintain duplicate auth models or implement password cryptography.

Authentication includes registration, required email verification, sign-in/out, a seven-day session lifetime, password reset with session revocation, profile updates, password changes, two-inbox email changes, and signing out other sessions. Reset links last 30 minutes; verification links last one hour. Password changes verify the current password and revoke other sessions. Cookies are HttpOnly, SameSite=Lax, and Secure for HTTPS origins. Database sessions are checked on protected requests; no localStorage tokens or session cookie cache are used. Required uniqueness indexes are awaited before traffic is accepted. Expired sessions and verification records have MongoDB TTL indexes.

The dashboard is protected on the server, and Express independently enforces authentication and verification on every `/api/v1/*` request. Video queries always filter by the authenticated user ID and use validated cursor pagination. The video collection records upload sessions, validation state, source metadata, and ownership. New accounts show actual empty states. Each account receives one 15-minute source-processing allowance. The dashboard and credit history show real available, reserved and used balances. No sample history or fake processing is created. Development-only purchases are explicitly simulated in a separate test wallet.

## Configuration and email delivery

See `back-end/.env.example`. `BETTER_AUTH_URL` is the frontend origin, not the internal API address. It is also the exact trusted origin; arbitrary callback origins are rejected. If the internal API address changes, set `API_INTERNAL_URL` for the frontend **before building** and at runtime. It defaults to `http://127.0.0.1:4000`. Never prefix secrets with `NEXT_PUBLIC_`.

`MAIL_TRANSPORT=file` is local only. Real delivery uses `MAIL_TRANSPORT=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and an approved `MAIL_FROM` address. Port 465 uses TLS; other ports require STARTTLS. Authentication mail delivery runs outside the public response path to reduce account-existence timing differences and logs delivery failures without recipient addresses or tokens. Pending delivery is drained on graceful shutdown. Durable mail queues/retries are not implemented in this phase. SMTP connectivity/authentication was verified, and the owner reported a successful real-email test. Automated tests continue to use isolated local mail capture.

Production mode rejects file mail capture and non-HTTPS auth URLs. No VPS or production deployment has been performed. Before public launch, configure and verify SMTP delivery, publish reviewed privacy/terms and a verified contact channel, and inspect Invitation Maker's deployment setup as requested without modifying that project.

Rate limiting is enabled in development and production and is stored in MongoDB. Sensitive routes use stricter limits. The loopback-only API overwrites caller-supplied IP headers with its socket address; this prevents spoofing. Requests forwarded through Next currently share a loopback rate-limit bucket. During the deployment phase, configure exact trusted proxy/client-address handling after inspecting the real reverse-proxy setup, rather than broadly trusting forwarded headers. This conservative shared bucket is unsuitable for public multi-user traffic without that deployment configuration.

## Quality checks

```sh
npm run lint
npm run typecheck
npm run format:check
npm run build
npm test
```

The backend integration tests use isolated MongoDB replica-set databases, real Redis/BullMQ jobs, and private local S3-compatible storage. They cover authentication/security, upload signatures and ownership, actual metadata checks, file/size/duration restrictions, atomic storage limits, staging replay protection, retry delivery after queue interruption, stale-job recovery, and cleanup. Test users, databases, and storage directories are removed afterward.

Browser tests run against the production frontend with a separate test API, ephemeral database/Redis, private local object storage, validation worker, and local mailbox. Stop normal application servers on ports 3000 and 4000 before running them; your persistent development database can remain running. Tests never use its data. Build first:

```sh
npx playwright install chromium webkit
npm run build
npm run test:e2e
```

Tests cover the landing page, registration through verification and recovery, settings, private uploads, interrupted-transfer retry, actual validation status, invalid media, removal, protected redirects, mobile navigation, light/dark/system preferences, pre-hydration theme selection, 320–1440px layouts, axe accessibility checks, SEO/noindex metadata, dialogs, the public YouTube form, and verified-account trial claiming. Screenshots and failure traces are saved in ignored `front-end/test-results/`. Browser engines with mobile viewport sizes do not replace physical device testing or field Core Web Vitals measurements.

`npm audit --omit=dev` passes. The full audit reports development-only findings in TypeScript ESLint (minimatch) and the local S3 emulator (legacy multipart/XML dependencies). The local emulator is loopback-only, rejects unsigned/untrusted-origin requests, and rejects POST/multipart form uploads; never deploy it or install development dependencies as production services. Runtime dependencies pass the production audit. Upstream-compatible upgrades do not currently resolve all development findings.

## Design and scope

The landing page follows `design-reference/index.html`. Its three local WebP previews remain unchanged in `front-end/public/previews/`. The assets show gaming/reaction content; obtain approved podcast/education footage and confirm licensing before public launch. Page copy addresses a broad creator audience. Still-image previews are labeled, and the file picker never uploads or processes content.

The SVG logo follows the supplied written description: a flat lime square and dark play triangle. No separate logo reference image was present. Both themes persist preference and resolve before first paint. Private dashboard and authentication pages are noindex; public pages are included in the sitemap. Social metadata, icons, and factual WebSite structured data are present.

Landing navigation now connects to real sign-in/registration routes. Free, Starter, Creator and Studio packs share the same features. Local sandbox/simulated purchases remain separate from production, which uses Paddle live checkout. Clip generation is available when its backend tools and Anthropic key are configured. The dashboard upload action is functional. Launch prices and the cost assumptions are documented in the credit-system section below. Privacy, terms and contact are available as public pages at `/privacy`, `/terms` and `/contact`. The contact form sends validated messages to the confirmed administrator through the configured mail transport, with a fixed sender and the visitor address in Reply-To.

Phases 1–4 and YouTube imports are implemented. Free credits, guest trials and output choices are implemented. Paid plans, payments, Google login and VPS deployment remain later phases.

## Private uploads and validation

The browser requests a session from `POST /api/v1/uploads`, then PUTs the file directly into private S3 staging storage using a ten-minute URL bound to one key, exact byte length, and content type. Credentials and source object keys are never returned to the browser. Write endpoints require the signed-in verified owner and the exact frontend origin. Extension/type/size and ownership confirmation are validated before a session is issued.

Storage counters track actual bytes and recordings; they no longer impose account quotas. Initial uploads reserve the higher of source-duration credits, a 1-credit minimum, or 2 credits per GB for 30-day media retention. Small uploads use a signed staging PUT. Large uploads use server-created multipart sessions, exact signed part sizes, server-side part listing (R2), and a frozen private source; interrupted parts can be retried on the same page. Part completion never trusts a client-supplied size or checksum list. Staging and a frozen source may temporarily duplicate bytes until cleanup.

`POST /api/v1/videos/:id/complete` verifies the stored size, content type, and ETag, records a queued state, and submits an idempotent BullMQ job. A worker copies the staged object to a separate source key with an ETag precondition, streams it to a bounded temporary file, hashes it, and checks its real container, video stream, dimensions, encryption state, and duration. The metadata reader uses MediaInfo WebAssembly in a terminable worker thread with a 20-second timeout and a 32 MiB metadata-read budget. It only sees the local temporary file and makes no network reads. Temporary files are removed after success or failure. Transcription and clip creation are available after upload validation. FFmpeg decodes the selected ranges during rendering; malformed media can still fail that later decode step.

The user sees waiting, queued, checking, ready, or failed states. “Upload ready” means the source is stored and checked; no clips have been generated. Detail pages poll while work is active. Connection failures during transfer can be retried on the same page; failed confirmation can be retried without sending the bytes again. Multipart retries reuse completed parts while the page stays open; reloading still starts a fresh session. Small abandoned sessions expire after 30 minutes and multipart sessions after 24 hours. Temporary validation failures retry three times with backoff and can then be retried manually. Invalid media must be replaced.

The database is the durable record of queued work. The worker reconciles missed queue submissions, reschedules stale validations with a new generation, and prevents stale attempts from overwriting newer state. A checked source lives at a separate key, so reusing the staging PUT URL cannot modify it. Removing a source hides it immediately. The worker removes its stored objects and atomically releases its reservation after session expiry, so an outstanding PUT URL cannot be used to evade cleanup/account limits. Failed videos retain their source slot until the user removes them. Run the worker continuously for validation and cleanup.

Worker commands, if running processes separately:

```sh
npm run dev:worker --workspace @clipvelto/api
npm run start:worker --workspace @clipvelto/api
```

`UPLOADS_ENABLED=false` keeps the API/account foundation available without storage; run the API and frontend separately in that mode, rather than the combined command that includes the worker. `UPLOAD_QUEUE_PREFIX` separates environments. Redis must use `maxmemory-policy=noeviction` and persistent storage. Public infrastructure and process/container resource limits are part of the deployment phase. Validation and transcription share one globally serial queue. Monitor temporary disk capacity for one source download up to `UPLOAD_MAX_BYTES` plus decoded audio, model weights, logs, and build files.

## What you need to provide for real hosting

The local workspace now uses the private Cloudflare R2 bucket `clipvelto-media`. Its object-only service key is restricted to that bucket and stored in the ignored backend environment file. Existing local media was copied with matching keys, ETags and SHA-256 contents before switching; local originals remain available as a backup. Before publishing the application:

1. **A private R2 (or S3-compatible) bucket.** Provide its S3 endpoint, bucket name, region, and bucket-scoped read/write access key ID and secret through `back-end/.env`. R2 normally uses `https://<account-id>.r2.cloudflarestorage.com` with region `auto`; use its S3 endpoint, not a public/custom download URL. Set `STORAGE_FORCE_PATH_STYLE` for the chosen provider. Keep public bucket access disabled.
2. **Bucket CORS.** Apply `back-end/storage-cors.json`, adjusting the allowed origin if needed. Add `http://localhost:3000` only if testing real cloud storage locally. The browser needs signed PUT access with content-type/content-length and ETag exposure. Set a bucket lifecycle rule to expire the `staging/` prefix after one day as a backup for abandoned objects; do not expire `sources/` unless a separate source-retention policy is approved. Reference: [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/) and [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
3. **Working SMTP credentials and a verified sender.** Local authentication emails are captured, not delivered. Test verification, password reset, and email-change delivery with your real provider before launch.
4. **Confirm storage retention and capacity.** New source/clip media expires after 30 days; failed or unpaid sources are kept for 24 hours for retry. Existing records without an expiry are preserved. Keep the worker running for cleanup, including abandoned multipart parts. Source duration and storage are governed by credits, while provider object-size limits, disk capacity, validation, request-rate protection and global media concurrency remain technical constraints.
5. **Later, VPS and public-launch setup.** Production MongoDB replica-set access, private persistent Redis, HTTPS/domain routing, exact proxy/client-IP handling, reviewed policies/contact details, backups, and monitoring. The existing Invitation Maker deployment must be inspected before that phase; it has not been modified or inspected as part of this upload work.

Real R2 checks passed for signed browser uploads, conditional copies, byte-range playback, downloads, private access and localhost CORS. The current CORS policy allows `http://localhost:3000`; add the exact HTTPS frontend origin when the deployment domain is known. Redis remains local. SMTP connectivity/authentication was verified separately, and the owner reported successful inbox delivery. Local transcription needs no API key. Hosted transcription needs the configured provider’s DEEPINFRA_API_KEY or GROQ_API_KEY, and highlight selection needs ANTHROPIC_API_KEY. No VPS deployment has occurred.

## Hosted transcription with DeepInfra or Groq

For faster transcription without running Whisper inference on the VPS, set these **backend-only** values in `back-end/.env` and restart the API and worker:

```env
TRANSCRIPTION_ENABLED=true
TRANSCRIPTION_PROVIDER=groq
GROQ_API_KEY=your_private_groq_key
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
```

DeepInfra uses the same bounded audio/checkpoint pipeline, with its native speech API and word timestamps. To select it, use:

```env
TRANSCRIPTION_PROVIDER=deepinfra
DEEPINFRA_API_KEY=your_private_deepinfra_key
DEEPINFRA_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
```

An inference-only DeepInfra key is sufficient; account, model administration, voice and deployment permissions are not needed. `whisper-large-v3` is also supported. Keys never belong in `NEXT_PUBLIC_` variables. The model and source hash must match before reusing saved chunks. A switch between Groq and DeepInfra using the same Whisper model preserves completed chunks; their original provider is retained and the resulting transcript is marked `mixed`. A provider switch does not enqueue or restart jobs automatically. The existing retry button resumes them. There is no silent provider fallback or automatic balance top-up. See the [DeepInfra model API](https://deepinfra.com/openai/whisper-large-v3-turbo/api). Its listed base rate on November 17, 2026 was $0.00020/minute ($0.012/audio-hour), excluding retries and chunk overlap.

Create a key in the [Groq console](https://console.groq.com/keys). Keep it out of chat, frontend variables and Git. The model can also be `whisper-large-v3`. Groq mode requires FFmpeg/FFprobe but does not require Python or a local Whisper model. Local mode remains the default for fresh development setups and is selected explicitly with `TRANSCRIPTION_PROVIDER=local`; a hosted-service failure never silently starts local inference.

The worker verifies/downloads the frozen source, extracts only its first audio track to bounded 16 kHz mono PCM, and sends WAV chunks of at most five minutes plus one second of context on either side. Each upload is below 10 MiB and requests word/segment timestamps. Audio is sent to the configured DeepInfra or Groq service; transcript candidate text is sent to Claude. Storage remains private, and no public source URL is needed. Provider words are ordered by timestamps, boundary context is assigned to exactly one chunk, and bounded caption segments are constructed locally. See the [Groq speech-to-text API](https://console.groq.com/docs/speech-to-text).

Completed chunks are saved in the video's private, normally excluded MongoDB `transcriptionCheckpoint` field, tied to the immutable source hash, model and decoded sample count. Both standalone transcription and automatic clip transcription resume that progress after a failure. Saving is fenced by the active generation/run, so cancellation/deletion cannot restore stale progress. The checkpoint is removed atomically when the full transcript is saved. Switching source/model invalidates earlier chunks. A request interrupted before its result was saved may need to be billed again; completed saved chunks are reused. This is recovery metadata, not a billing/credit ledger.

Each chunk has a 60-second request budget. Explicit 429/server errors get at most one retry, only when the delay is at most five seconds; authentication errors, long rate limits and uncertain network failures stop with a safe message. Raw provider error text, audio, keys and transcript text are not logged. Normal completion/failure/cancellation removes temporary audio files. Authenticated recordings are funded by credits without the old 30-minute/two-hour plan ceilings. Groq decodes one bounded audio chunk at a time, large transcript/checkpoint documents move to private R2, and highlight selection ranks bounded sections before selecting the final highlights. An individual serialized transcript has a 512 MiB safety bound. Source files still need enough temporary disk space; capacity failures do not spend processing credits.

The configured key was verified with a synthetic spoken fixture and an existing 22m54s recording. A local benchmark of that already imported recording took 13.6s for hosted transcription, 3.5s for selection and 15.1s for five checked 720×1280 captioned renders, about 32.5s total. This excludes YouTube downloading, queue wait and final object uploads, and is not a VPS or concurrent-load benchmark. Existing videos/clips were preserved. Provider speed, rate limits and audio complexity vary.

Groq's listed Turbo transcription price at verification was $0.04/audio hour; chunk context, retries and the provider's minimum billed duration add usage. Claude, storage and VPS costs are separate. Check [current pricing](https://console.groq.com/docs/speech-to-text) before launch. Automated provider tests mock Groq, while real FFmpeg processing and checkpoint recovery are exercised:

```sh
RUN_MEDIA_TESTS=1 npm test
RUN_GROQ_TESTS=1 RUN_MEDIA_TESTS=1 npm run test:e2e
```

## Local CPU transcription

Install Python 3.9 or newer with virtual-environment support (Python 3.11–3.13 recommended for the VPS), then run:

```sh
npm run transcriber:setup
```

The setup command creates an isolated Python environment under `back-end/.local-data/transcriber-venv/`, installs the pinned faster-whisper release, and downloads the selected public model into `back-end/.local-data/whisper-models/`. Initial setup needs network access and disk space for the model and Python packages. Set `TRANSCRIPTION_ENABLED=true` in `back-end/.env`, then restart the API and worker. Keep that setting false until setup succeeds. The checked-in example deliberately defaults to disabled so a fresh install never advertises an uninstalled transcriber.

Defaults suit the initial shared 4-vCPU / 8-GB VPS: multilingual `small` model, CPU int8, two inference/decoder threads, one global worker job, recordings up to 1,800 seconds, and a 1,800-second transcription timeout. `tiny` and `base` are optional speed/accuracy tradeoffs; rerun setup after changing models. Environment variables and optional absolute Python/cache paths are documented in `back-end/.env.example`. Thread limits are not hard container CPU/memory limits; configure and benchmark those during deployment. The 30-minute transcription limit is independent of the existing two-hour source-upload limit.

From a checked video's detail page, click **Transcribe video**. Speech remains on the machine running the worker; no transcription API key is needed. The worker verifies the source ETag, size, and SHA-256, downloads it to a private temporary directory, decodes bounded local audio through PyAV, and runs faster-whisper with voice-activity filtering and word timestamps. PyAV bundles media decoding libraries, so standalone FFmpeg is not required for this step. Runtime model loading is offline; only setup downloads model weights. See [faster-whisper documentation](https://github.com/SYSTRAN/faster-whisper) for CPU int8, word timestamps, and voice-activity filtering.

Transcripts include detected language, segment text/times, and word times. The owner can view paginated text and download TXT or SRT; JSON is available from `GET /api/v1/videos/:id/transcript`. These endpoints require the verified owner's session, return `no-store`, and never expose object keys. Transcript content is excluded from library/detail queries and only loaded explicitly. Automatic transcripts can contain errors and need review. Missing audio or speech produces a clear empty result rather than fabricated captions. The dashboard runs transcription as part of clip creation; there is no separate transcription step to start. The transcript becomes available after processing. The standalone transcription API remains available for compatibility.

`POST /api/v1/videos/:id/transcribe` atomically persists the request before enqueueing. Concurrent requests are idempotent; missed delivery is reconciled. Transcription does not automatically repeat expensive failed work: the owner explicitly retries, creating a new fenced generation. Heartbeats detect interrupted jobs, and deletion cancels running inference on the next heartbeat (up to ten seconds). Graceful shutdown terminates the Python child. Late results cannot restore deleted videos or overwrite newer runs. Normal success/failure paths remove temporary files; an abrupt host crash/SIGKILL can leave a temporary directory, so deployment needs a bounded stale-temp cleanup policy. Small transcript JSON stays in MongoDB; larger transcripts and checkpoints are stored privately in R2, referenced by the owner-scoped video, and removed with its media. Backups and retention must include both stores.

Run the optional real-model backend and browser checks after setup:

```sh
RUN_LOCAL_TRANSCRIPTION_TESTS=1 npm test
RUN_LOCAL_TRANSCRIPTION_TESTS=1 npm run test:e2e
```

The browser suite uses an isolated API/database/Redis/storage and a synthetic spoken-video fixture; it never sends real email or speech to an external service. Without the flag, ordinary tests cover the queue/security/retry lifecycle with a controlled transcriber and the real-model cases are skipped. Local macOS CPU checks do not predict Contabo throughput or verify Linux Docker resource limits. Before deployment, measure representative recordings and both sites' responsiveness on the VPS. Its current snapshot shows headroom, but peak load remains unmeasured.

## Signup and real email

The signup/sign-in dialog switches between creating an account, password sign-in, email verification and password recovery in place. Email signup rejects duplicate registrations with “An account with this email already exists. Please sign in.” It does not authenticate the user or replace the existing password, including when the submitted password matches. The endpoint stays rate limited; this explicit message reveals account existence as requested. New/unverified accounts receive a 6-digit email code, valid for 5 minutes with at most 5 attempts. A successful code verifies the address; the retained password is then used to create the session. Passwords stay in component memory, never browser storage. Closing the dialog discards them. Standalone `/sign-in`, `/sign-up`, `/verify-email` and `/forgot-password` pages use the same flow. Password recovery uses a code, and email changes require codes from both inboxes. Older password-reset links remain supported for compatibility.

Codes are stored as keyed hashes. Sending is limited per IP and per email address (60-second cooldown, 10/hour), with neutral responses for unknown accounts and one-time atomic verification. The browser remembers only the pending email in sessionStorage for one hour. SMTP settings are unchanged. `GET /api/auth-config` exposes only local capture status; local capture instructions appear only in development.

Nodemailer is already integrated and does not require a custom-domain mailbox. For free, low-volume testing you can use an existing Gmail account with 2-Step Verification and an App Password if available for that account. Create the password using [Google's App Password instructions](https://support.google.com/accounts/answer/185833), then set these in `back-end/.env`:

```env
MAIL_TRANSPORT=smtp
MAIL_FROM="Clipvelto <your-address@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-address@gmail.com
SMTP_PASSWORD=your_16_character_app_password
```

Use the Gmail address as the sender and an App Password rather than the normal account password. Restart the API after changing the environment. `npm run mail:check` verifies SMTP connectivity and authentication without sending a message. Then sign up with a test account to verify actual sender acceptance/inbox delivery; this is a separate check. Keep `BETTER_AUTH_URL=http://localhost:3000` while testing locally, so email links open your local app. SMTP has not been connected or tested against a real mailbox because those credentials have not been supplied. Gmail can impose sending limits and reject unfamiliar sign-ins; review [Nodemailer's Gmail guide](https://nodemailer.com/guides/using-gmail) before choosing the production sender.

## YouTube videos and active streams

The upload page starts with **From YouTube**; **From device** preserves private direct uploads. YouTube importing requires Python 3.11+, FFmpeg/FFprobe, Node.js for the supported yt-dlp JavaScript runtime, and the pinned yt-dlp package:

```sh
npm run media:setup
npm run media:check
```

Install the OS media tools first. On macOS, `brew install ffmpeg-full python@3.12` provides the required tools; use the absolute FFmpeg/FFprobe paths printed by Homebrew when that keg is not linked. On Linux, install an FFmpeg build with libx264, AAC, and libass plus appropriate fonts. The setup script creates `back-end/.local-data/media-venv/`; it does not install OS packages. Supported overrides are in `.env.example`:

```env
YOUTUBE_ENABLED=true
FFMPEG_PATH=/absolute/path/to/ffmpeg
FFPROBE_PATH=/absolute/path/to/ffprobe
# Optional; default is back-end/.local-data/media-venv/bin/python
# YOUTUBE_PYTHON=/absolute/path/to/venv/bin/python
```

`POST /api/v1/imports/youtube` accepts a single HTTPS YouTube video/shorts/live URL, a rights confirmation, and a 60–600 second live window (default 300). The server canonicalizes the video ID before invoking the importer; arbitrary URLs, credentials, ports, playlists and channels are rejected. Imports are stored privately through the same local S3 emulator or R2 adapter. No public R2 URL or YouTube API key is used.

Finished recordings import in full when the wallet can reserve their verified duration/storage quote. The upload page checks metadata and shows an estimated quote before confirmation. The worker independently checks metadata again and atomically reserves credits before downloading, then adjusts to the actual checked file before transcription. Insufficient credits stop the import with an add-credits message and a retry action. Only bounded, allowlisted metadata/errors cross the process boundary; signed CDN URLs, headers and raw provider errors are excluded. A currently active livestream records a bounded window from when its queued job begins, near the live edge. It does not record the entire past broadcast or continuously monitor the channel. Upcoming streams and newly ended streams still being prepared by YouTube may fail until a playable recording becomes available. Private, members-only, age-restricted, removed, region-blocked or bot-blocked videos can fail. An optional administrator-provided YouTube session is supported as described below; importing does not grant permission to use a recording. The device upload remains available. Media selection caps both source dimensions at 1920 pixels, preserving 1920 × 1080 landscape and 1080 × 1920 portrait sources; yt-dlp must be maintained as YouTube changes. Reference: [yt-dlp setup and dependencies](https://github.com/yt-dlp/yt-dlp#dependencies).

An import reserves one source slot and the maximum allowed file size atomically before queueing. After a successful import, actual checked size replaces the reservation in the same transaction as source completion. Failed imports retain the reservation until removal/cleanup. Imports and processing share the globally serial queue. Capture is at most ten minutes, overall import timeout is twenty minutes, individual downloads are size-bounded, and temporary space must account for separate video/audio and merge files (up to roughly three times the source cap). Removal stops child process groups on the next heartbeat, fences stale writes, and cleans recorded artifact keys and per-video prefixes. Normal completion/failure removes temporary directories; deployment still needs a stale-temp policy for abrupt host/process crashes.

A real public YouTube recording was downloaded successfully during local verification. The API/live-window lifecycle is tested using a controlled importer plus actual media validation/storage; capture against the user's own currently live stream remains for the user to test.

### Optional self-hosted YouTube session

Production YouTube requests can receive a human-verification challenge even for public videos. Updating yt-dlp or changing its client does not guarantee that YouTube will accept the server. All imports still run on our VPS; no managed import service or proxy subscription is required by this implementation.

If the administrator chooses authenticated requests, follow [yt-dlp’s YouTube-only cookie export instructions](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies) using a dedicated account. Account use can be challenged or restricted, and exported sessions can expire. Do not use a primary Google account or export unrelated browser sessions. Never put the cookie contents in chat, Git, logs, frontend configuration or R2.

Save the YouTube-only Netscape cookie file privately with mode `600`, then set `YOUTUBE_COOKIES_FILE` to its absolute path for local development. On the VPS, the deployment script creates `/var/www/clipvelto/youtube-session` with mode `700` and owner `1000:1000`. Privately install the file there as `cookies.txt`, owned by `1000:1000` with mode `600`, and set this in the production backend environment:

```env
YOUTUBE_COOKIES_FILE=/run/clipvelto-youtube/cookies.txt
```

Recreate only the Clipvelto API and worker after enabling or disabling that environment variable. The directory is mounted read-only into those containers. The importer rejects symlinks, non-files, shared-readable files and exports larger than 1 MiB; it retains only YouTube domains in a private per-job copy. yt-dlp can update that temporary copy without altering the mounted original. Normal job cleanup removes the copy. Leave the variable unset until the private file is installed. A successful metadata request alone does not prove imports work: verify a short permitted media download before declaring recovery.

### YouTube session outage handling

Real import/quote requests detect YouTube bot challenges, explicit expired/rotated-cookie warnings, or an unavailable private session file. The API and worker share a persisted outage record; no extra YouTube polling requests are generated. New homepage trials, workspace imports, quotes and import retries receive a temporary-unavailability response before creating new reservations or consuming trial allowance. Individual unavailable/private videos and ordinary download errors do not automatically pause every import.

Submitted imports stay queued and release their credit reservations atomically. While the same session remains blocked, the worker checks the saved outage state every five minutes without making another YouTube request. Device uploads and processing of already imported media continue. After a new YouTube-only export replaces the private cookie file, queued imports can retry automatically without an API/worker restart, still subject to normal credit, ownership and retention checks. A successful request with that replacement closes the outage. Trial jobs still expire after 24 hours; other media retain their configured expiry.

The worker attempts an administrator email through the configured mail transport on its 30-second maintenance cycle. `YOUTUBE_ALERT_TO_EMAIL` overrides `CONTACT_TO_EMAIL`. MongoDB leases and incident identifiers suppress concurrent duplicate alerts and keep the state across deployments; failed mail delivery retries after 15 minutes. As with SMTP generally, a crash after mail acceptance but before recording success can cause a duplicate. Cookie contents, signed media URLs and visitor details are never included in alerts or the outage record.

Renewal remains an operator action when Google requires sign-in or human verification. Export only the dedicated account’s YouTube cookies, transfer them privately, then install the replacement atomically on the VPS (the source below is an example private upload path):

```sh
install -o 1000 -g 1000 -m 600 /root/youtube-cookies.txt /var/www/clipvelto/youtube-session/cookies.txt.next
mv /var/www/clipvelto/youtube-session/cookies.txt.next /var/www/clipvelto/youtube-session/cookies.txt
```

Keep the source export private as well. Do not overwrite the mounted file progressively or put cookies in environment values, source control, chat, email or public storage. Export replacement is detected by a content digest, not a timer; re-uploading identical invalid cookies does not clear the pause. Automated login, OTP/CAPTCHA solving and guaranteed uninterrupted YouTube access are not implemented.

## Create clips

Enable local transcription and install the media tools above, then add the Anthropic key only to `back-end/.env`:

```env
TRANSCRIPTION_ENABLED=true
CLIPS_ENABLED=true
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-haiku-5-5
```

Restart the API and worker after configuration changes. The worker checks installed tools and the cached Whisper model when local transcription is configured. New uploads and imports automatically queue clip creation after successful validation when both features and the highlight key are configured. The queued state is saved with source completion, so reconciliation can recover missed queue delivery. The dashboard shares the homepage progress component and shows real stages and elapsed time. Existing checked sources can still use **Create clips**, and failed generation has a single retry action that reuses saved work.

The generation job downloads the frozen source with ETag/size/hash checks, reuses a saved transcript or transcribes once, groups speech into mutually non-overlapping candidate windows at transcript boundaries, and asks Claude to rank their IDs with strict tool inputs. Each candidate's text appears only once in the request. The tool schema is stable across recordings, avoiding a new grammar for each video's candidate IDs; returned IDs are checked locally. Invalid selections get at most one repair request, with a 45-second timeout per request; HTTP credential/rate-limit failures are not retried automatically. Source audio/video stays on the worker; candidate transcript text is sent to Anthropic for highlight analysis. Selection aims for 3–5 highlights, but 1–2 valid choices are accepted rather than failing sparse recordings or making another paid call solely to fill a quota. Long-source highlights remain 15–60 seconds; short test recordings can produce clips down to three seconds. Duplicate choices are removed, titles are trimmed to 100 characters, and fabricated IDs, overlaps and ranges outside the source are rejected. There is no automatic random/non-AI highlight fallback. A saved transcript is reused after a selection failure; a saved transcript and highlight plan are both reused after a rendering failure.

Failures identify the failed stage (source read, transcription, selection, rendering, or storage). Each generation saves `clipTimingsMs` and logs sanitized stage durations, cache reuse and clip counts. Selection diagnostics record rejection codes and counts without transcript/provider text or keys. Timings describe observed work, not a promised completion time or billing ledger.

New outputs are H.264/AAC with CRF 18 video, 160 kbps AAC and source frame rate preserved up to 60fps. Choose 1080 × 1920 (9:16, default), 1920 × 1080 (16:9), or 1080 × 1080 (1:1). An explicit yes/no caption choice is required for new uploads/imports; legacy recordings retain their existing caption preference. Enabled ASS captions are grouped from word timings. The image fills the selected export: landscape footage is cropped at the sides, with no added letterbox/pillarbox padding or stretching. Cropping happens before upscaling to avoid processing discarded pixels. Source sample aspect ratio is accounted for. Captions sit above the lower playback/social controls with readable sizing and side margins.

`npm run media:setup` also installs pinned OpenCV headless in the media Python environment. Framing samples at most 121 low-resolution frames at two per second; local Haar face/profile detection guides a bounded horizontal crop path. Movement is smoothed, with abrupt crop changes at detected scene cuts; frames without detected faces fall back to a recent position briefly, then the center. This is best-effort face-guided reframing, not active-speaker identification or perfect object tracking. Multiple people, occlusions, sports and rapid cuts can need manual editorial review. If analysis is unavailable or exceeds its budget, rendering still uses a full-frame center crop. Frame samples are private and removed after analysis; no extra paid AI calls or runtime model downloads occur. Source content that already contains black pixels/bars is not automatically erased.

Each clip has a 256 MiB output cap and ten-minute render timeout. Previously completed previews/downloads remain available while replacement clips render, including after a failed replacement. Successful replacement atomically switches the clip list and increments its render revision so players load the new media. Old object keys remain tracked for deletion with the video. Format version 3 identifies the configurable high-quality exports. Existing version 2 clips stay playable; changing defaults does not silently regenerate or improve old files. Download routes independently check verified ownership and return a private signed GET lasting sixty seconds. Raw clip object keys are not exposed in video/list responses. Generated clips are included in the initial source processing charge. New media follows the 30-day retention policy described below; real payment collection remains later work.

Completed clips also play directly on their detail page using native controls, seeking, fullscreen and inline mobile playback, without autoplay. Preview routes check verified ownership and issue private inline GET links valid for fifteen minutes, with byte-range support from object storage. Reload preview refreshes access after an expired link or playback error. Download MP4 remains available separately. Signed inline playback with byte ranges was verified against the private Cloudflare R2 bucket; automated checks use private local S3 storage.

Claude access and actual highlight selection were verified using the configured key on a synthetic speech fixture, and its selection was rendered into a real captioned MP4. No key values are printed or stored in tracked files. No VPS deployment has occurred.

For the full optional local media test suite:

```sh
RUN_LOCAL_TRANSCRIPTION_TESTS=1 RUN_MEDIA_TESTS=1 npm test
RUN_LOCAL_TRANSCRIPTION_TESTS=1 RUN_MEDIA_TESTS=1 npm run test:e2e
```

Supply `FFMPEG_PATH` and `FFPROBE_PATH` to these commands if the required build is not on PATH. Automated tests use an isolated database/storage/queue, synthetic speech fixtures, a controlled YouTube importer and controlled Claude selections; FFmpeg rendering and downloads are real. Separately executed live-provider checks verify the public YouTube download and the configured Anthropic API. Browser tests cover both source tabs, import status, captions/MP4 downloads, signup's remembered email, and local-mail guidance. Actual live-stream capture, Linux Docker limits and VPS peak-load performance remain unverified.


## Free credits, public trial and administrator access

Every account starts with **900 seconds once**, including any claimed homepage trial. The wallet and immutable activity ledger govern usage; details and launch prices are below. There is no monthly reset or second signup grant. Administrator processing remains exempt. Paid source length, file counts and account-storage quotas are replaced by credit reservations, while ownership, media validation, one global job and two encoding/inference threads remain enforced.

The homepage trial imports **up to the first three minutes** of one finished YouTube recording, capped at 150 MiB. Currently live streams require a verified workspace account. The worker selects real highlights and renders one watermarked 720 × 1280 preview in a single pass. All full-quality 1080p exports are deferred until verified claim. Real blurred source frames illustrate the locked highlights; no unlocked videos are exposed. The UI shows persisted processing stages and elapsed time rather than an invented completion percentage or ETA. Public responses do not expose source IDs, transcript text, master keys, hidden highlight titles or full-quality download URLs. A verified login claims ownership and storage quota and debits actual imported duration atomically. Insufficient credit/storage rolls back the whole claim. Repeated/concurrent claims cannot debit twice or transfer the video to two owners. Unlock reuses the saved transcript and plan; older trials can also reuse an existing full-quality first clip.

Guest access uses a random 256-bit HttpOnly cookie, only its SHA-256 hash in MongoDB, a 24-hour unclaimed result lifetime, a HMAC network fence of one trial per 24 hours, and a daily global budget (`TRIAL_DAILY_MINUTES=30`, at most ten three-minute submissions). Failed attempts retain this attempt budget to bound provider abuse. Expired unclaimed sources and artifacts are removed by the worker before source quota is released. All masters remain private and owner-authorized; public preview URLs expire after 60 seconds. A playable watermarked preview can still be recorded or saved. Cookies, network limits and verified email reduce abuse; they cannot prove a unique human or prevent all new-network/new-account abuse.

Public trials are **off by default**. Enable them after supplying valid Turnstile keys. Add these backend-only values to `back-end/.env`, then restart the API and worker:

```dotenv
TRIAL_ENABLED=true
TURNSTILE_SITE_KEY=your_widget_site_key
TURNSTILE_SECRET_KEY=your_widget_secret_key
TRIAL_DAILY_MINUTES=30
```

Use separate Turnstile widgets for local development and production, allow the correct hostname, and keep `BETTER_AUTH_URL` set to the exact frontend origin. The server requires Siteverify success, the expected hostname and action `trial`, and locally consumes each challenge hash once. An unavailable/invalid challenge fails closed. See [Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) and [testing guidance](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). The browser widget has compact sizing for small screens. No test key bypass is accepted by the production HTTP routes; simulated verification exists only as a dependency of the isolated test server/tests.

**Production deployment:** see the deployment status below. The API now supports a single explicitly trusted Nginx hop behind loopback-only host ports; local development defaults to trusting no proxy. Do not trust arbitrary client forwarding headers or enable the local trial bypass in production. No live YouTube stream was supplied for the final capture test.

Grant administrator access locally to an existing **verified** account using:

```sh
npm run admin:grant --workspace @clipvelto/api -- owner@example.com
```

This records an audit entry and grants unlimited free-credit/submission allowance. Administrator processing has no package duration or account-storage quota. It does not bypass ownership, global job concurrency, per-source validation or transfer deadlines. No signup/profile request can set its role. The requested owner account was granted access locally. Revoke/change roles through controlled database administration until a dedicated admin UI is authorized.

The landing header and plan CTA use the authenticated server session and refresh via Better Auth's client session state. Session cookies remain HttpOnly, SameSite=Lax and Secure on HTTPS, with server-side verification and no browser-stored bearer tokens. Google sign-in is supported when its backend credentials are configured. Payment integration remains deferred.

## Export quality and current limits

The previous 720p import cap, 720 × 1280 output and CRF 23 encode contributed to reduced detail. New imports preserve sources up to a 1920-pixel edge in either orientation; new exports use the settings above and Lanczos scaling after cropping. Higher resolution cannot restore detail missing from the source. A 16:9 source cropped to fill a 9:16 frame discards side pixels, so a 720p landscape input cannot provide native 1080p portrait detail. Choose horizontal output to retain a landscape composition. Captions already burned into the input cannot be switched off; the caption choice controls Clipvelto's added captions only. Face-guided cropping remains best effort.

An offline yt-dlp selection check also verified that native 1080 landscape and portrait formats are selected while 4K variants are excluded. The earlier 32.5-second benchmark above used the previous 720p renderer and is historical. New 1080p rendering is more expensive; completion time depends on source, queue, provider limits and hardware. Real source quality, crop, caption placement and final social-platform recompression should be reviewed on a representative recording before launch.


## Previous verification before the guest UX update

The earlier baseline passed lint, strict typechecking and production build. The current guest UX and single-pass preview changes were reviewed in the running development app; build, lint, TypeScript checks and automated suites were not run for these changes, as requested. The backend suite passed 81 tests with local/media/Groq test modes enabled, including real FFmpeg exports for all shapes at 50fps, no-padding pixel checks, optional captions, concurrent credit reservations, refunds, role restrictions, Turnstile response validation, trial budgets/ownership/expiry and full preview-to-unlock processing. External transcription, highlight and YouTube services are controlled fixtures in automated tests; no real provider usage is required.

To exercise the public trial browser flow, use a fresh isolated test API for each browser project. Both browser projects intentionally share the same loopback network allowance when run together, so run these commands separately (the test server starts/stops each time):

```sh
RUN_GROQ_TESTS=1 RUN_MEDIA_TESTS=1 RUN_TRIAL_TESTS=1 npm run test:e2e -- --project=chromium --workers=2
RUN_GROQ_TESTS=1 RUN_MEDIA_TESTS=1 RUN_TRIAL_TESTS=1 npm run test:e2e -- --project=webkit --workers=2
```

These browser tests mock the Turnstile script and verification only in the isolated test harness. They cover signup/verification/claim, inline 720p trial and 1080p private previews, horizontal exports with captions off, downloads, login persistence on the homepage, mobile widths, both themes and automated accessibility scans. Real Turnstile and a physical iPhone must still be checked when configured. Screenshots are written to ignored `front-end/test-results/`.


## Google sign-in

Create a **Web application** OAuth client in the Google Auth Platform for the Clipvelto project. Use External / Testing while developing. Register `http://localhost:3000` as an authorized JavaScript origin and exactly `http://localhost:3000/api/auth/callback/google` as a redirect URI. For production, add the equivalent HTTPS origin and callback for the actual domain; keep localhost and production clients separate. Set both backend-only values in `back-end/.env`, then restart the API:

```env
GOOGLE_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

The Google button is disabled until both are configured. Only OpenID, email and profile are requested. Google uses a top-level authorization-code redirect, avoiding embedded browsers/iframes and popup blockers. Successful sign-in returns to the dashboard, where the existing cookie-protected homepage-trial claim runs. Cancellation and errors return to the homepage sign-in dialog with a short fixed message. In Testing mode, add the intended test accounts to the Google project's audience where required; publish/configure production branding and domains before launch.

Better Auth handles state, PKCE and the HttpOnly state/session cookies. Callback identities additionally pass Google's JWT signature, issuer, audience, expiry and verified-email checks. Same-email linking is allowed only when the local address is already verified; an unverified local account must verify/recover via email first. Existing IDs, credits and videos are retained. New Google users receive the same free allowance. Google access, refresh and ID tokens are discarded before account storage because Clipvelto only needs identity. Different-email linking, unchecked redirects and extra Google API scopes are not enabled.

An isolated local OAuth simulation checked creation, verified same-email linking, preserved identity, token disposal, blocked unverified claims/accounts, PKCE/scopes, missing state cookies, state replay and redirect/scope rejection. The localhost Google client is configured; live account selection/consent is checked separately from the isolated OAuth simulation. No build, TSC or lint checks were run for this change.

The automatic device-upload and YouTube-import flows were checked with isolated database/queue/storage, controlled import/transcription/highlight providers, and real FFmpeg rendering. Both reached an owner-authorized download without a separate transcription or generation request, without duplicate processing charges. No build, lint or TypeScript checks were run for this update.

Administrator duration, checkpoint, credit-exemption and automatic import-to-clip behavior passed targeted isolated checks. The same checks confirmed the regular account policy still uses the original file/duration limits. No build, lint or TypeScript checks were run.

A real administrator import of the 1h 57m 52s recording `5B1FGk3CMyg` completed the full pipeline and produced five captioned 1080 × 1920 clips. All five private R2 objects matched their recorded sizes; a signed attachment download returned the requested byte range. The administrator used zero credits and held no credit reservation after completion. The completed clips and the absence of the stale trial notice were observed in the running dashboard.


## Credit packs and simulated checkout — November 2026

| Pack | One-time USD price before tax | Credits | Source minutes before any storage minimum |
| --- | ---: | ---: | ---: |
| Free | $0 | 15 once | 15 |
| Starter | $6 | 120 | 120 |
| Creator | $15 | 360 | 360 |
| Studio | $32 | 900 | 900 |

The shared catalog is `packages/credit-plans`. Pack prices exclude applicable tax (`taxMode: external`); Paddle calculates and adds required tax at checkout. Pricing cards disclose this before checkout. All packs offer the same aspect ratios, optional captions, highlight selection and private downloads. Credit packs are additive: buying another pack preserves unused credits and existing jobs, with no subscription, downgrade or monthly expiry. Buying a pack never grants administrator privileges.

One credit is 60 source seconds. The server charges `max(60, ceil(verifiedDurationSeconds), ceil(sizeBytes / 1e9 * 120))` credit-seconds, not a rounded whole-minute deduction for every chunk. The storage minimum (2 credits per decimal GB for 30 days) prevents a short, exceptionally large video from receiving unbounded storage at a negligible duration price. The higher duration/storage quote applies, not their sum. Upload metadata from the browser is preliminary; the server checks the real media before any paid transcription. YouTube estimates can change when actual downloaded size is checked. Insufficient funds stop paid work and preserve the checked source for up to 24 hours so the user can add credits and retry.

MongoDB replica-set transactions atomically reserve and allocate credit lots with job creation and retry state. Conditional balance updates prevent parallel jobs spending the same funds. The completed clip result and its final credit debit commit in one transaction. System failures release processing reservations, preserve reusable transcripts/plans and allow retry without spending twice. A separately requested standalone transcript charges on successful transcript delivery; subsequent clips reuse that recording's reservation. A claimed public preview already delivers usable media and charges once at its atomic ownership transfer. Playback/downloads and re-opening a result do not spend credits. Deleting completed media does not refund used credits. Submitted jobs cannot be cancelled by users: device-upload cancellation is not offered, and the backend rejects deletion of uploading, queued, importing, processing and failed jobs. Failed jobs remain retryable until retention cleanup. Only videos with completed clips and no queued/running transcription may be deleted. Deletion is owner-scoped and checked transactionally, does not refund used credits, and removes media through background cleanup. Legacy cancellation settlements are retained only to finish removals already requested under the earlier policy. Crash reconciliation recovers durable queued work and releases terminal/abandoned reservations. Each video captures its wallet mode; an unpaid idle retry can switch to the currently configured wallet, while paid work stays with its original ledger.

`CreditAccount` remains the trusted role/legacy balance record. A wallet's opening entry migrates existing available/reserved/used amounts exactly once; it never resets a used account to 15 credits. Existing held reservations continue to use the opening lot. Every subsequent purchase, reservation, debit, release and refund is an account-scoped ledger event with a unique event key. FIFO purchased lots allow the simulator to refund only an entirely unused, unreserved pack without taking spent credits back or creating a negative balance. Public signup/profile fields cannot choose prices, credit quantities, wallet modes or roles. Billing mutations require a verified session, the exact application Origin, strict bodies and bounded request rates. Histories show the latest 50 purchases and 100 credit events; older events remain in the database.

### Local testing

For explicit local simulations, set `BILLING_MODE=mock` in `back-end/.env` instead of `paddle`. Restart your own API and worker if they have not reloaded the setting. Open **Dashboard → Credits & billing**, choose a pack and simulate success, decline or cancellation. No card number is requested and no money is taken. Paid test purchases can also be replayed or refunded when wholly unused. Buy another pack to test an upgrade/top-up, then create/retry a video and check available, reserved and used credits. Use a regular account for deduction checks: the administrator is deliberately exempt.

The test wallet starts as a snapshot of the account's existing live available/used balances (not another free grant), then remains separate. Simulated purchases and processing cannot alter the live wallet. Test-funded jobs cannot start in live mode, and test media is hidden and inaccessible in production. The server refuses to start with `NODE_ENV=production` and `BILLING_MODE=mock`. Production must use `BILLING_MODE=disabled` until Paddle live onboarding, domain approval and verified webhook setup are complete. Sandbox mode is also refused in production. Test mode still calls real configured media providers and can incur provider charges. No Stripe account, checkout or webhook has been connected.

### Paddle checkout

Paddle Billing is integrated for the same one-time credit packs. `BILLING_MODE=paddle` with `PADDLE_ENVIRONMENT=sandbox` funds only the test wallet. `mock` remains available for explicit local simulations. Real collection stays off by default (`PADDLE_LIVE_ENABLED=false`).

1. Create a **separate sandbox account**. Save its `PADDLE_API_KEY` privately in `back-end/.env`. Catalogue setup needs product/price read+write, client-token read+write and checkout-setting read+write. Optional webhook setup needs notification-setting read+write. The running service needs transaction read+write, price read and adjustment read; reduce setup permissions once configuration is complete.
2. Run `npm run paddle:setup --workspace @clipvelto/api -- --checkout-url=https://YOUR-OWN-DOMAIN/dashboard/billing --activate`. This creates/reuses tagged SaaS products, tax-exclusive one-time USD prices with quantity fixed at one, and a public Paddle.js token. A price/policy change creates a matching new price instead of rewriting an old purchase. It saves the price IDs/token privately and enables **sandbox only**. Paddle requires a default payment-link domain, although the local overlay can be tested on localhost. Do not use someone else’s domain.
3. Restart your API and worker if they do not reload automatically. Open **Dashboard → Credits & billing**. The page says **Paddle sandbox**. Use Paddle’s [sandbox test cards](https://developer.paddle.com/sdks/sandbox/); never use a real card in sandbox.
4. For externally reachable notifications, rerun setup with `--webhook-url=https://YOUR-OWN-DOMAIN/api/webhooks/paddle`. It saves the endpoint secret and subscribes to transaction creation/updates/completion/cancellation and adjustment creation/updates. The route receives the raw signed body before JSON/session middleware. Until a sandbox webhook can reach your machine, checkout completion is independently verified through Paddle’s server API; a bounded API reconciliation pass checks pending transactions every 30 seconds while the API runs, including after a browser closes. Webhook delivery itself still needs a public URL.

Required saved values: `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_STARTER`, `PADDLE_PRICE_CREATOR`, `PADDLE_PRICE_STUDIO`. `PADDLE_WEBHOOK_SECRET` is optional only in local sandbox and required for live. The browser receives only the public client token and its own order/transaction references. Never put an API key or webhook secret in `NEXT_PUBLIC_` variables. No new long-running terminal service is required.

Server-created orders fix the owner, mode, pack, price, tax mode and credit quantity. Paddle API responses must match those values, one item/quantity, USD and a non-recurring price before fulfillment. Discounts are rejected unless a private `billing_discounts` approval matches the Paddle environment/discount ID, original price and signed-in account. Approved percentage discounts verify the full original subtotal, exact discount and net total from Paddle. Each approval is consumed atomically with one order’s credit grant; concurrent orders cannot reuse it. Approvals remain stored for delayed events and refunds, while expiry and redemption hide the checkout code field. Purchase history records the amount actually paid, including tax, without changing the catalog price or credit quantity. Tax-inclusive purchases verify the gross transaction total against the order price; the pre-tax subtotal varies by tax jurisdiction. Existing orders retain their original inclusive or exclusive tax treatment, amounts and validation, including delayed confirmations and refunds. Current tax-exclusive purchases verify the pre-tax subtotal against the immutable order price. Earlier pending purchases can be checked, but the UI starts new checkouts from the current catalog instead of reopening an outdated price. The database commits the purchase grant and order state atomically; event IDs and grant references prevent replay/double credits. Checkout creation is claimed atomically and never blindly repeated after an ambiguous timeout because Paddle does not offer general API idempotency keys. A later signed transaction event can recover that binding.

A verified full refund removes an entirely unused pack automatically. Partial refunds, credits, chargebacks and refunds involving consumed/reserved credits mark the order **review** and hold new account processing until support reconciles the balance. These cases are deliberately manual; they are not silently treated as successful automatic refunds. Existing reserved jobs may finish. The admin Users page surfaces payment review status. Refund eligibility follows Paddle’s buyer policy and applicable consumer rights; an app credit release is not a payment refund.

Before enabling live collection: complete Paddle business/identity/payout and domain verification; deploy HTTPS; configure separate live keys, products/prices and the live webhook; review legal/operator details and the published refund policy; confirm live delivery and the manual review process. Only then select `PADDLE_ENVIRONMENT=live`, `PADDLE_LIVE_ENABLED=true` and `BILLING_MODE=paddle`. Never reuse sandbox credentials, fund a live wallet with test purchases, or activate live mode on a local HTTP origin.

### Launch economics assumptions

These are **estimated contribution margins, not guaranteed net profit**. The example below assumes 15% tax added to the displayed base price, a $0.01 operating allowance per fully used credit for transcription, highlight calls, storage/requests and contingency, and a conservative payment allowance of 5% of the checkout total + $0.50. Actual fees and tax treatment depend on Paddle settlement details and the customer's location:

| Pack | Customer total with 15% tax | Base revenue | Operating allowance | Payment allowance | Estimated contribution |
| --- | ---: | ---: | ---: | ---: | ---: |
| Starter | $6.90 | $6.00 | $1.20 | $0.85 | $3.95 |
| Creator | $17.25 | $15.00 | $3.60 | $1.37 | $10.03 |
| Studio | $36.80 | $32.00 | $9.00 | $2.34 | $20.66 |

Subtract the shared **$7/month VPS** once from the month's combined contributions, then subtract free-user/trial processing, support, other business taxes, refunds/chargebacks, exchange costs, marketing and any additional infrastructure. The example treats collected sales tax as pass-through, not revenue; do not deduct it from base revenue again. Payment allowances are rounded up to the cent. Other customer tax rates can change payment fees. One Starter sale alone would not cover that month's VPS. More sales spread the fixed server bill; concurrency/CPU capacity still needs measurement before scaling. The $0.01 operating allowance is a planning assumption, not a hard supplier-price ceiling; Paddle settlements also depend on tax treatment. Heavy free usage or future worker upgrades can reduce these margins; review actual bills before activating paid checkout.

Supplier references checked November 17, 2026: [Groq speech-to-text pricing](https://console.groq.com/docs/speech-to-text) lists Whisper Large V3 Turbo at $0.04/audio-hour; [R2 Standard pricing](https://developers.cloudflare.com/r2/pricing/) lists $0.015/GB-month plus operations and no egress charge. [Paddle pricing](https://www.paddle.com/pricing) lists 5% + $0.50 per checkout; settlement details and tax treatment must be checked against the actual account. Anthropic costs depend on the configured model and tokens. Do not advertise the estimate as guaranteed profit.

Focused validation for this change covered duplicate/concurrent payments, owner/origin isolation, failed/cancelled payments, reservations, cancellation settlement, old-balance migration, trial claiming, Groq chunk recovery, long-transcript highlight selection and a real FFmpeg/private-download path. No build, lint or TSC checks were run, as requested. Browser visual inspection was unavailable in this session; real mobile/iOS layout and full-size long-video load tests still need user validation.


## Public pages and contact messages

The footer links to `/privacy`, `/terms`, `/refunds` and `/contact`; those routes are included in the sitemap. The public navigation returns to homepage sections from these pages. The privacy/terms copy describes the current providers, account/trial cookies, private storage, credit rules, retention, automated-output limitations and development-only checkout without inventing a legal entity or jurisdiction.

Contact messages use the existing SMTP transport and default to the confirmed administrator account. `CONTACT_TO_EMAIL` optionally changes that backend-only destination; a visitor cannot supply a recipient or sender. Messages are plain text, headers are validated, and the visitor email is Reply-To. Delivery errors are returned as errors rather than a false success. File transport is explicitly labeled local capture in development. Production requires SMTP and configured Turnstile keys. The existing Turnstile widget uses a separate `contact` action checked on the server, independent of whether public video trials are enabled. Origin checks, a honeypot and expiring hashed network/email rate counters limit abuse. Message contents are sent to the administrator's inbox and are not copied into application database records. The shared proxy trust boundary still needs deployment configuration before public traffic.

Public typography uses 16px body text and controls, 14px supporting text, and responsive heading sizes. Homepage pricing shows Free, Starter, Creator and Studio as four cards, with format/caption/download features inside each card. No build, lint, typecheck or tests were run for this UI and contact-page change, as requested.

## Google profile photos and account switching

Google sign-in saves the photo from the verified provider profile for new users and synchronizes it for existing, verified accounts. Existing-account synchronization checks the Google subject binding (or the verified same-email link target) and updates only `image`; names, email addresses, provider bindings, roles, credit balances and video ownership are unchanged. Missing or untrusted photo URLs leave the existing image alone. Google tokens are still discarded. The verified `/me` response includes the image, displayed in workspace navigation and profile settings with an initials fallback. Existing sessions with no stored photo need one fresh Google sign-in to obtain it.

Email sign-in completion and sign-out use a full navigation to discard previous client workspace state. The dashboard also observes the authenticated session and replaces the workspace when its user ID changes, including cross-tab session changes. API video queries and individual media/download routes remain scoped to the authenticated owner's user ID.

## Creator guides and public SEO

`/blog` lists 19 static articles across four linked topic collections under `/blog/topics/`: gaming, video-editing, podcasts and repurposing. The library covers editing, publishing, podcasts, webinars and interviews, plus 11 GTA 6 articles. Six general GTA additions cover platform/PC status, storage and downloads, editions, vehicles, exploration and music; they do not require a clipping angle or show the article-level product CTA. Existing articles are preserved. `/youtube-to-shorts` and `/podcast-clip-maker` describe the product workflows. Article content is collected in `front-end/src/content/articles.ts` from the topic-specific modules beside it; reusable GTA image data lives in `gta-media.ts`; workflow copy lives in `workflows.ts`. Dates describe the actual source review on November 17, 2026. Recheck release dates and platform rules before updating the content, and update `modified` only after an actual editorial change.

GTA articles use 15 unchanged, locally stored 1920 × 1080 JPEGs from Rockstar’s official screenshot collection. Other covers use six real Pexels photographs, resized and cropped for the website. Visible captions identify the photographer or publisher and link to the original source. `front-end/public/blog/gta-6-image-credits.json` and `photo-credits.json` record asset provenance and license/source links. The earlier diagram covers have been removed. Next.js Image serves responsive local JPEGs; article rendering does not depend on a third-party image request. Stock photography is illustrative and does not imply endorsement.

Article headers, bylines, covers, captions and body text share an 800px maximum reading column. The contents list is a native accessible disclosure; related reading is limited to three relevant articles. Article and topic navigation explicitly targets `#top` so Next.js does not preserve a previous article’s bottom-of-page position. The URL canonicals omit the fragment. The shared footer groups product, blog/topic and company links. Public pages use “Blog” consistently in navigation.

The guides render without authentication or API access and have static route parameters, semantic headings, source links, image dimensions, related guides and responsive layouts. Each public page has its own title, description, canonical URL, Open Graph and Twitter card. `/og/[slug]` renders allowlisted, cached 1200 × 630 PNG sharing cards; the earlier `/opengraph-image.png` URL remains available for old links. Structured data describes the real organization, website, articles, breadcrumbs and guide collection without ratings or unsupported product claims.

`/sitemap.xml` includes public pages, all articles, the four topic collections and article images. Topic pages are visible from the blog and footer; there are no hidden keyword/doorway pages. Modification dates are explicit rather than regenerated on every request. `/robots.txt` points to that sitemap and excludes private dashboard/API paths. Authentication pages remain crawlable so their `noindex` directives can be read; they are absent from the sitemap. Authentication and dashboard layouts explicitly prevent indexing.

Focused review for the editorial redesign used the existing development server: the original 17 article/topic URLs returned 200 with a unique canonical and one H1; a related-article click ended at scroll position zero; desktop/mobile screenshots were reviewed in both themes, with no horizontal overflow at 320px, 390px or 768px on the checked article. No build, lint, TSC or test suite was run. Physical iOS device behavior was not checked.

The canonical origin is centralized in `front-end/src/lib/seo.ts` as `https://clipvelto.com`. Before public release, confirm it matches the deployed HTTPS domain. If using Google Search Console's HTML verification method, put only the verification **content value** in `GOOGLE_SITE_VERIFICATION` in the frontend environment (for local development, `front-end/.env.local`). The production deployment needs that value too. Deployment, Search Console ownership verification and sitemap submission are separate from this local implementation. Google controls discovery, indexing and rankings; metadata and a sitemap do not guarantee inclusion.

The subsequent GTA expansion verified all 11 GTA article routes and the new sitemap entries. Every GTA article now contains at least three credited official images; the new vehicles and exploration articles contain four. Inline images use the same accessible figure/caption component as other articles and load lazily. The storage guide distinguishes available installation space from download size, and its transfer table is explicitly a calculated 200 GB example. Unannounced PC specifications and unverified location exploits are not presented as confirmed information.

## Shared Contabo deployment

Clipvelto follows the existing Invitation Maker deployment pattern: GitHub Actions builds the Linux AMD64 frontend/backend images, GHCR stores them, and SSH updates Docker Compose on the VPS. `deploy/frontend.dockerfile` produces a Next.js standalone image; `deploy/backend.dockerfile` includes the compiled API/worker, Python importer/face framing and FFmpeg with captions/watermarks. Application builds run in CI, not as local validation commands.

The inspected server is `207.244.254.33` (`vmi3566643`). Invitation Maker production occupies loopback 3000/4000 and development occupies 3001/4001. Clipvelto uses the separate `/var/www/clipvelto` directory, Compose project `clipvelto`, and loopback 3002/4002. Its MongoDB replica set and Redis have authentication, their own persistent volumes and an internal Docker network; neither publishes a host port. The API/worker use a database-scoped MongoDB user. The media worker has global concurrency one, at most two inference/encoding threads, a 1.5-CPU quota and 2560 MB memory limit. Other containers also have CPU/RAM/log limits. These are initial limits, not a throughput guarantee.

### Prepare once

1. Run `node deploy/prepare-env.mjs` locally. It copies the required provider settings from the private local backend environment and creates fresh production auth/database/Redis secrets in `.local-data/production/` with mode 0600. It refuses to overwrite an existing set; preserve the database passwords across releases. Local accounts and test wallets are not migrated. Production starts with a fresh database, real-wallet mode and payments disabled. Anonymous video generation starts disabled until the production Turnstile hostname is verified.
2. Securely upload `backend.env`, `frontend.env`, `mongo.env` and `redis.env` to `/var/www/clipvelto/` on the VPS, plus the Compose file and `deploy/mongo-*` scripts. Keep the directory 0700 and env files 0600. Do not commit these files, put provider secrets into image build arguments, or copy Invitation Maker's environment. Compose must support `env_file.format: raw` so credentials containing `$` or `#` remain unchanged (the inspected VPS uses Compose v5.5.1).
3. Configure this repository's GitHub Actions secrets: `VPS_HOST=207.244.254.33`, `VPS_PORT=22`, `VPS_USER=root`, a dedicated `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS` obtained from the already-verified server host key. Never disable host-key checking or copy the root password into the repository. Optional repository variable `GOOGLE_SITE_VERIFICATION` is included in the frontend build. The workflow runs on `main` pushes or manual dispatch and tags releases with immutable commit SHAs.
4. Point Hostinger's root `A` record for `clipvelto.com` to `207.244.254.33` and retain `www` as a CNAME to `clipvelto.com`. Remove a stale root AAAA record if there is no configured IPv6 route. Confirm public DNS resolves correctly before requesting TLS or submitting Paddle's website review. The earlier screenshot's `2.57.91.91` address is not this VPS.
5. Install `deploy/nginx.conf` as a new `/etc/nginx/sites-available/clipvelto`, and `deploy/proxy-headers.conf` as `/etc/nginx/snippets/clipvelto-proxy.conf`. Once healthy application images are deployed, enable only the new Clipvelto vhost, run `nginx -t`, reload Nginx, and run `certbot --nginx -d clipvelto.com -d www.clipvelto.com --redirect`. Keep the existing Invitation Maker vhosts and certificates intact.

The Nginx `/api/` location goes directly to the API; all other paths go to Next.js. Nginx **replaces** X-Forwarded-For/Host/Proto; `TRUST_PROXY_HOPS=1` is safe only with these loopback-published upstreams. Never expose port 4002 publicly or enable extra forwarding hops. Leave `TRUST_PROXY_HOPS=0` for direct local development. If adding a CDN/proxy later, review its authenticated real-IP boundary first. Guest trials and auth/contact limits use this resolved client IP. `TRIAL_LOCAL_TESTING=false` is mandatory in production.

### Production service configuration

Add `https://clipvelto.com` and callback `https://clipvelto.com/api/auth/callback/google` to the Google OAuth web client and complete Google's production publishing requirements before opening Google sign-in to everyone. Add `clipvelto.com` to the Turnstile widget hostname list, then enable `TRIAL_ENABLED=true` only after a real challenge succeeds. R2 stays private: allow browser requests from `https://clipvelto.com` in bucket CORS (GET, HEAD, PUT; allowed headers `content-type`, `content-length`, `range`; expose ETag and range/length response headers). Multipart creation/completion happens on the authenticated backend; browser part uploads use PUT. Do not enable public R2 bucket access. Verify OTP/recovery/contact SMTP delivery from the deployed application. The homepage, legal pages and normal verified account uploads can be deployed before Paddle approval.

Production now uses `BILLING_MODE=paddle`, `PADDLE_ENVIRONMENT=live`, and `PADDLE_LIVE_ENABLED=true`. The approved live catalog charges $6/120 credits, $15/360 credits and $32/900 credits, plus applicable tax. Its active webhook is `https://clipvelto.com/api/webhooks/paddle`. Preserve the private live credentials and flags across deployments. Sandbox purchases never fund production wallets. Do not replace the working local sandbox environment. A fresh deployment must remain disabled until its own live approval and webhook setup are complete.

### Releases, rollback and maintenance

The CI deployment validates and pulls the next Compose configuration before replacing it, waits for service health and records `.image-tag`. Its short-lived GHCR login uses a Clipvelto-specific Docker config directory, so it does not overwrite Invitation Maker's registry login. It never globally prunes images or removes database volumes. A failed deployment is reported as a failure; rollback is deliberate: inspect the failing service, restore `compose.yaml.previous` if appropriate, then run `IMAGE_TAG=$(cat .image-tag.previous) docker compose up -d --wait`. Do not blindly rollback a database upgrade or delete volumes.

Inspect `docker compose ps`, `docker compose logs --tail=100 api worker`, `docker stats --no-stream`, `df -h`, and the two host health URLs (`http://127.0.0.1:3002/`, `http://127.0.0.1:4002/api/health`). Rotate/protect database backups and take a consistent `mongodump --oplog --archive --gzip` using the Mongo container's root environment without printing credentials; store an encrypted copy off the VPS and test restoration before relying on it. Backups, restore drills and alerting are operational launch requirements, not supplied by a Docker restart policy. Monitor remaining DeepInfra/Claude funds and R2 usage. The disk-backed `media-temp` volume can hold large recordings; remove orphaned temporary job directories only after stopping API/worker and confirming no active work. Never run `docker compose down -v` on production data. A VPS restart must retain Mongo, Redis and keyfile volumes.


### Deployment status — 17 November 2026

Clipvelto is deployed at https://clipvelto.com using GitHub Actions, GHCR images and the isolated VPS Compose project described above. The dedicated deployment key and pinned host keys are stored in this repository's encrypted Actions secrets. Keep the private production environment files and persistent volumes stable across releases.

- Hostinger points the root domain to `207.244.254.33`; `www` redirects to the HTTPS root. Let's Encrypt covers both hostnames and has automatic renewal configured.
- MongoDB and Redis are healthy, the application health endpoints return successfully, and the worker reports ready with DeepInfra selected. The existing Invitation Maker containers remain healthy.
- R2 remains private. Its CORS policy allows localhost and the HTTPS production origin; the production upload preflight returned 204 with the expected origin.
- The Turnstile widget allows `clipvelto.com`; its live widget completed successfully. Production trials are enabled, bounded to three minutes, with local repeat testing disabled.
- Google OAuth includes the production origin/callback and public policy links; the app is in production mode. The deployed sign-in initiation returned the correct callback, PKCE/state and Secure/HttpOnly cookie. The owner subsequently confirmed signing in on the live site, and the verified production account was found.
- SMTP connection, TLS and authentication succeeded from the production API container. Inbox delivery should be checked through an actual signup/OTP or contact submission.
- Production starts with a fresh database and live wallet mode. Local users, test purchases and media records were not migrated. Administrator access was granted and verified for the owner’s confirmed, verified production account, with an audit entry.
- Paddle live payments were enabled on 18 November 2026 with separate live credentials, approved account/domain and an active signed webhook. Live Starter checkout opened successfully; transaction.created and transaction.updated notifications were delivered and processed, while an unsigned webhook was rejected. The checkout was left unpaid, so a completed real payment and resulting credit grant have not been verified. Backups/offsite retention, restore verification and alerting still need operational setup. No full paid processing job, live-stream capture or physical iOS test was run during deployment. No local build, lint or standalone TypeScript checks were run; Docker image compilation ran in GitHub as part of deployment.


### Brand and sharing images

Open Graph and Twitter share one static 1200 × 630 PNG (8,396 bytes), using the existing lime play mark, Clipvelto name and “Video to shorts” description on a dark background. Metadata points directly to the asset with a versioned URL; previously shared `/og/…` URLs redirect to it. Favicons contain 16/32/48px variants, and the Apple icon is 180px. Next.js file metadata supplies the icon tags. Regenerate the assets with `node scripts/generate-brand-assets.mjs` after an intentional logo change. Article photos remain in the articles and their structured data.

### Email delivery — Resend

Production and the private local backend configuration now use Resend through the existing Nodemailer SMTP transport. `clipvelto.com` is verified with Resend's prescribed DKIM/sending DNS records and a monitoring DMARC record. The sending-only key is restricted to this domain and is held only in private environment files. No additional email SDK or public credential was added.

Use `MAIL_TRANSPORT=smtp`, `MAIL_FROM=Clipvelto <no-reply@clipvelto.com>`, `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587`, `SMTP_USER=resend`, and the restricted Resend key as `SMTP_PASSWORD`. Contact submissions continue to go to the configured administrator recipient; the submitter's address stays in Reply-To. The production API was restarted with these settings, and an approved setup email sent through the application's mail service was marked Delivered in Resend. Restart a previously running local backend to pick up the local environment change.

### Owner live checkout discounts — 18 November 2026

Two private, one-use Starter checkout codes were created in Paddle live: 100% off for a zero-value fulfillment check and 85% off for a $0.90-before-tax payment. They expire on 20 November 2026 at 23:59 UTC and apply only to the current $6 Starter price. Code strings and account-specific approvals are private operational data, not repository constants. Only the owner’s confirmed production accounts can receive credits from these approvals. The frontend exposes Paddle’s discount-code field to those accounts while an approval remains available; the backend enforces eligibility even if the browser is modified. No payment or free checkout was completed by the agent. A zero-value order does not test money collection; paid transactions incur Paddle fees and do not imply an immediate bank payout. Ordinary customer pricing stays unchanged.

### Persistent YouTube browser pilot

The optional `clipvelto-browser` Compose project is managed by `.github/workflows/youtube-browser.yml`, independently of application releases. It runs one headed Google Chrome instance as uid 1000 with a persistent private profile, Chromium sandboxing, a bounded private `/dev/shm`, 0.75 CPU and 1280 MiB memory. It receives no application, database, mail or billing credentials. Its only shared writable data is the private YouTube session directory; the API/worker retain read-only mounts. Keep `youtube-browser-profile` private (0700), outside Git/backups/R2, and never seed it with a personal browser profile.

The owner completes the initial dedicated-account sign-in through the private noVNC screen. The VPS publishes only `127.0.0.1:6082`; CDP and raw VNC remain inside the browser container. Reach the viewer through an authenticated SSH local forward, never through public Nginx or a public port. `python control.py open` inside `clipvelto-browser-session-1` creates a random one-hour access link. The WebSocket gateway validates the token and expiry against a private file and always targets the same internal VNC listener. `python control.py close` revokes the token and closes existing viewer connections within ten seconds. Restarting the container also invalidates the link. Do not share the private login URL or put it in logs/issues/chat.

Cookie export is disabled until the operator confirms the dedicated account and runs `python control.py enable-sync`. That approval persists in the private profile. `disable-sync` stops publishing. The service checks the signed-in YouTube avatar and required authentication cookies, exports only unexpired/unpartitioned YouTube cookies, and installs a 0600 Netscape file atomically. Visitor/analytics-only changes do not trigger another publication. Changed authentication cookies are published at most once every five minutes, with last-publication state preserved across restarts. Normal page refresh is bounded to once per fifteen minutes and suspended while the login viewer is enabled. Imports take a shared advisory `browser.lock`; browser refresh/export takes its exclusive lock, preventing deliberate refresh during an active import. A failed browser check preserves the existing export.

`python control.py status` reports only readiness/sync/publication timestamps, and the container healthcheck monitors the controller heartbeat. `session-synced` means cookies were published, **not** that YouTube accepted a download. Existing outage alerts, pauses, credit release and queued retry rules still apply. Confirm recovery with a short permitted media download before announcing restoration. Google login/challenges and account restrictions may still require operator action. This is an experimental recovery path, not a guarantee of continuous YouTube imports. Passwords, OTPs and CAPTCHAs are never automated.

The production pilot was activated on 18 November 2026 after the owner signed in with the dedicated account. A 5.03-second download contained both video and audio; the existing session monitor confirmed recovery and cleared the import pause. The temporary viewer token, SSH forwarding key and local login files were revoked/removed afterwards. The browser continues running on the VPS without the owner's Mac or home connection. If Google requires another sign-in, reopen a fresh private viewer through SSH and have the owner complete it; automatic synchronization cannot solve a Google challenge or guarantee session lifetime.

After publishing a browser image, deploy it with `IMAGE_TAG=<browser-commit> docker compose -f youtube-browser.compose.yaml up -d --wait`. Application image tags and `.image-tag` are separate. Preserve the browser profile across releases; do not delete it to fix unrelated application problems. No local build, lint or TSC checks are needed for this operator service; focused tests cover cookie filtering, authentication changes, file permissions and expiring access tokens.

### Microsoft Clarity

The production site uses Clarity project `zfwos3evxf` through one asynchronous `next/script` tag in the root layout. There is no consent popup or preference UI. Both advertising and analytics storage are denied through `consentv2`, so Clarity operates in cookieless mode without identifying visitors across page views through Clarity cookies. The project has default cookies turned off, Strict masking and sensitive URL parameter masking; the root DOM is explicitly masked as well. Localhost and preview hosts do not collect analytics. Do not add `identify` calls with emails/account IDs or unmask user content. The privacy policy and terms disclose analytics. No additional npm package, secret or backend endpoint is needed. Browser blockers may prevent collection, and dashboard reporting is delayed.
