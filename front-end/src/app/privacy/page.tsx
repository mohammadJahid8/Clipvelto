import { publicMetadata } from "@/lib/seo";
import Link from "next/link";
import { PublicPage } from "@/components/layout/public-page";
export const metadata = publicMetadata({
  title: "Privacy policy",
  description:
    "How Clipvelto collects, processes, stores and protects account information, videos and contact messages.",
  path: "/privacy",
});
export default function PrivacyPage() {
  return (
    <PublicPage
      title="Privacy policy"
      intro="What we collect, why we need it, and the choices you have."
      updated="17 November 2026"
    >
      <article className="public-prose">
        <section>
          <h2>Who is responsible for your information</h2>
          <p>
            Clipvelto operates this service and is responsible for the account
            and service information described here. You can reach the
            administrator through our <Link href="/contact">contact page</Link>,
            including for privacy questions or requests about your information.
          </p>
        </section>
        <section>
          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Account information:</strong> your name, email address,
              verification status and account settings. Email and password
              sign-in uses a password hash, rather than a readable password. If
              you choose Google sign-in, we receive your Google identifier,
              name, email address and verification status; we do not receive
              your Google password.
            </li>
            <li>
              <strong>Your videos and results:</strong> uploaded recordings,
              submitted YouTube links, source metadata, audio used for
              transcription, transcripts, selected highlights, captions and
              generated clips.
            </li>
            <li>
              <strong>Service records:</strong> credit balances, reservations,
              usage history, purchase and payment-reference records, processing
              status, errors and necessary security records.
            </li>
            <li>
              <strong>Contact messages:</strong> the name, reply email, subject
              and message you submit.
            </li>
            <li>
              <strong>Browser and connection information:</strong> session and
              trial cookies, theme preference and connection information used
              for security. Network identifiers used for contact and trial
              limits are stored as keyed hashes, rather than as raw addresses in
              those limit records.
            </li>
          </ul>
        </section>
        <section>
          <h2>How we use information</h2>
          <p>
            We use this information to create and protect your account, import
            and process recordings, deliver results, track credits, prevent
            misuse, resolve errors and answer your messages. We use your email
            for account verification, sign-in or recovery messages and replies
            to your requests.
          </p>
          <p>
            Where data protection law requires a lawful basis, we rely on
            providing the service you request, legitimate interests in operating
            and protecting it, and legal obligations where applicable. Optional
            Google sign-in and submitting a recording are choices you make; any
            consent required for an additional use will be requested separately.
          </p>
          <p>
            We do not sell your personal information or use your recordings for
            advertising. We do not use your recordings or transcripts to train
            our own AI models.
          </p>
        </section>
        <section>
          <h2>Providers involved in the service</h2>
          <p>
            Only the information needed for a particular function is sent to the
            providers used for it:
          </p>
          <ul>
            <li>
              <strong>Cloudflare:</strong> private R2 media storage and
              Turnstile human verification. Turnstile processes browser and
              connection information to help detect abuse.
            </li>
            <li>
              <strong>DeepInfra or Groq:</strong> audio chunks and transcription
              settings are sent to the configured hosted transcription provider.
              If local transcription is selected instead, transcription runs on
              the processing server.
            </li>
            <li>
              <strong>Anthropic:</strong> transcript text and candidate moments
              used by Claude to select highlights. This selection step does not
              require sending the original video to Claude.
            </li>
            <li>
              <strong>Paddle:</strong> when you open Paddle checkout, Paddle
              processes billing, payment and necessary browser information. We
              store purchase references and payment status to manage credits; we
              do not store full card numbers or card security codes. Sandbox
              transactions are kept separate from live purchases.
            </li>
            <li>
              <strong>Google:</strong> identity verification when you choose
              Google sign-in.
            </li>
            <li>
              <strong>Hosting and email providers:</strong> running the
              application, storing service records, delivering account email,
              and delivering contact messages to the administrator’s inbox.
            </li>
          </ul>
          <p>
            These providers may process information in other countries and have
            their own contractual terms and retention practices. We do not
            control deletion of copies independently retained by a provider. We
            may also disclose information where required by law or necessary to
            investigate misuse and protect people or the service.
          </p>
        </section>
        <section>
          <h2>Cookies and browser storage</h2>
          <p>
            We use necessary cookies to maintain account sessions and connect an
            anonymous preview to the browser that requested it. Turnstile may
            use information necessary for its security checks. Your light, dark
            or system theme choice is saved in browser storage. These functions
            are not advertising tracking.
          </p>
          <p>
            You can clear cookies and browser storage in your browser. Doing so
            can sign you out or prevent an unclaimed preview from being
            recovered.
          </p>
        </section>
        <section>
          <h2>How long information is kept</h2>
          <p>
            New account media is normally available for 30 days. Failed or
            unpaid source recordings are normally kept for up to 24 hours for
            retry. Unclaimed homepage trials expire after 24 hours. Removal
            happens through background cleanup, so deletion may not be
            immediate. Some older recordings created before this policy may have
            no automatic expiry; you can remove them from your workspace or
            request deletion.
          </p>
          <p>
            Account information is kept while needed to provide your account.
            Credit and transaction records may be kept longer to resolve
            disputes, prevent duplicate grants, maintain accounting records or
            meet legal obligations. Contact messages are kept in the
            administrator’s inbox while needed to answer and follow up on the
            request, and longer where needed for a dispute or legal obligation.
            Temporary contact rate-limit records expire automatically.
          </p>
          <p>
            Security records and any backup copies may persist beyond removal
            from the live application. Copies you download, share or upload
            elsewhere are under your control.
          </p>
        </section>
        <section>
          <h2>Security and private access</h2>
          <p>
            We use account access checks, private media storage, expiring media
            links and server-side validation to protect the service. Authorized
            operators may access information when necessary to provide support,
            investigate a problem or meet a legal obligation. No internet
            service can guarantee complete security, and someone with access to
            a playable preview may be able to save or record it.
          </p>
          <p>
            Do not submit passwords, API keys or other secrets in recordings or
            contact messages. If you suspect an account or privacy issue,{" "}
            <Link href="/contact">contact us</Link>.
          </p>
        </section>
        <section>
          <h2>Your choices and rights</h2>
          <p>
            You can choose which recordings to submit, delete completed videos
            in your workspace and decide whether to use Google sign-in.
            Submitted jobs cannot be cancelled through the workspace. You can
            request access, correction, export or deletion of your account
            information through our <Link href="/contact">contact page</Link>.
            Depending on where you live, you may also have rights to object to
            or restrict processing, withdraw consent for a consent-based use, or
            complain to your local data protection authority.
          </p>
          <p>
            We may need to verify your identity before acting on a request. Some
            information may need to be retained for security, another person’s
            rights or a legal obligation. A request does not undo processing
            already completed lawfully.
          </p>
        </section>
        <section>
          <h2>Changes to this policy</h2>
          <p>
            We will update this page when our practices change and show the
            revised date above. Material changes affecting your information will
            be communicated through the service or your account email as
            appropriate.
          </p>
        </section>
      </article>
    </PublicPage>
  );
}
