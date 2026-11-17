import { publicMetadata } from "@/lib/seo";
import Link from "next/link";
import { PublicPage } from "@/components/layout/public-page";
export const metadata = publicMetadata({
  title: "Terms & conditions",
  description:
    "Terms for using Clipvelto, processing recordings, using credits and accessing generated clips.",
  path: "/terms",
  image: "/og/terms",
});
export default function TermsPage() {
  return (
    <PublicPage
      title="Terms & conditions"
      intro="The rules for using Clipvelto and working with your recordings."
      updated="17 November 2026"
    >
      <article className="public-prose">
        <section>
          <h2>Using Clipvelto</h2>
          <p>
            These terms govern your use of Clipvelto. By creating an account or
            submitting a recording for processing, you agree to these terms and
            acknowledge our <Link href="/privacy">privacy policy</Link>. If you
            do not agree, do not submit content or create an account. You must
            have the legal capacity, or any permission required where you live,
            to use the service.
          </p>
          <p>
            Clipvelto turns recordings into transcripts and short clips.
            Features, processing time and availability depend on your source,
            service configuration, processing capacity and external providers.
            We do not promise a particular number of highlights, processing
            time, social-media performance or audience growth.
          </p>
        </section>
        <section>
          <h2>Your account</h2>
          <p>
            Provide accurate account information, protect your sign-in
            credentials and use an email address you control. Some features
            require a verified account. You are responsible for activity you
            authorize through your account. Contact us promptly if you suspect
            unauthorized access.
          </p>
          <p>
            Do not access another person’s account, share access in a way that
            bypasses credit controls, or create accounts to repeatedly claim the
            same free allowance.
          </p>
        </section>
        <section>
          <h2>Your recordings and permissions</h2>
          <p>
            You retain the rights you hold in your recordings and other
            submitted content. You give Clipvelto and the providers needed to
            run it permission to store, copy, transcribe, reframe and process
            that content to provide the features you request. We do not claim
            ownership of your original recordings.
          </p>
          <p>
            Only submit content you own or have permission to process, including
            any copyright, music, image, voice and privacy permissions required.
            A publicly available YouTube link does not by itself grant
            permission. You remain responsible for following YouTube’s terms and
            the rules of any platform where you publish your clips.
          </p>
          <p>
            Do not submit unlawful content, exploitative material, malicious
            files, content that infringes someone’s rights, or material you are
            not permitted to share with the processing providers described in
            our privacy policy.
          </p>
        </section>
        <section>
          <h2>Generated results</h2>
          <p>
            Transcription, captions, highlight selection and framing are
            automated and can be inaccurate or omit context. Review your results
            before downloading or publishing them, especially names, claims,
            sensitive information and caption timing. Export resolution depends
            on your source; a higher output resolution does not restore detail
            missing from the original recording.
          </p>
          <p>
            You are responsible for your use of generated results and for having
            the rights needed to publish them. We do not guarantee that any
            result is unique or free of third-party rights.
          </p>
        </section>
        <section>
          <h2>Free access, previews and credits</h2>
          <p>
            A new account receives 15 free credits once, including credits used
            by a claimed homepage trial. The anonymous preview is limited to the
            first three minutes of a finished recording and shows one
            watermarked preview. A verified account is required to save the
            result and unlock the remaining selected moments. Public previews
            also have security and abuse-prevention limits.
          </p>
          <p>
            One credit represents one source-video minute, measured in seconds,
            with a minimum of one credit for a new recording. For large files, a
            storage minimum of two credits per GB for 30 days applies when it is
            higher than the duration quote. We show a quote and verify the
            actual recording before paid processing. An estimated quote may
            change when the real duration or size is checked; processing stops
            if your credits cannot cover it.
          </p>
          <p>
            Credits are reserved before processing and charged when usable clips
            are saved. If you request a standalone transcript, it is charged
            when that transcript is delivered. Saved results and recoverable
            retries of the same recording reuse that recording’s charge. A
            successfully claimed homepage preview is charged once when saved to
            your account. Downloads and playback do not cost additional credits.
          </p>
          <p>
            Submitted jobs cannot be cancelled, including while queued,
            importing or processing. System failures release the processing
            reservation and allow recovery where available. You can delete
            videos after clip generation finishes. Deleting completed media does
            not restore credits already used.
          </p>
          <p>
            Unused credits do not expire under the current pack policy. Credits
            are an allowance to use this service, have no cash value, and cannot
            be transferred between accounts or redeemed for cash.
          </p>
        </section>
        <section>
          <h2>Prices and payments</h2>
          <p>
            Published credit packs are prepaid, one-time packs, not
            subscriptions. Buying another pack adds to the existing balance.
            Prices and applicable payment conditions will be shown before any
            real purchase.
          </p>
          <p>
            Checkout marked as sandbox or payment testing takes no real payment
            and uses a separate test balance. Video processing with test credits
            can still use real processing providers. Simulator refunds are
            limited to wholly unused, unreserved test packs.
          </p>
          <p>
            When live Paddle checkout is enabled, Paddle is the reseller for
            purchases made through it. Published pack prices exclude applicable
            taxes; Paddle calculates and adds any required tax and shows the final total
            before payment. Credits are added only after server-side
            payment confirmation. See our{" "}
            <Link href="/refunds#top">refund policy</Link> for payment support
            and credit adjustments. New processing may be restricted while a
            refund or disputed balance is reviewed.
          </p>
        </section>
        <section>
          <h2>Storage and deletion</h2>
          <p>
            New media is normally kept for 30 days; failed or unpaid sources and
            unclaimed trials are normally kept for up to 24 hours. Background
            cleanup may take additional time. Older recordings may have a
            different expiry; check your workspace and keep your own copies of
            anything important. Clipvelto is not a permanent archive or backup
            service.
          </p>
          <p>
            Removing a video requests deletion of its stored source and
            generated assets. Necessary account, security, credit or dispute
            records may remain as described in the{" "}
            <Link href="/privacy">privacy policy</Link>. We cannot remove copies
            you or others have saved outside Clipvelto.
          </p>
        </section>
        <section>
          <h2>Service protection and availability</h2>
          <p>
            Do not bypass authentication, credit reservations, preview locks,
            rate limits or other security controls; disrupt background jobs;
            distribute malware; scrape private content; or use the service to
            send spam. We may stop processing or restrict access where
            reasonably necessary to investigate misuse, protect the service or
            comply with law.
          </p>
          <p>
            Uploads and imports remain subject to media validation, provider
            limits and available server resources. Live capture records a
            bounded future window rather than continuously monitoring a channel.
            Private, restricted or provider-blocked YouTube recordings may not
            import. Keep a copy of your source and use a device upload when a
            permitted import is unavailable.
          </p>
        </section>
        <section>
          <h2>Responsibility and resolving problems</h2>
          <p>
            The service is provided subject to the limitations explained here.
            To the extent permitted by applicable law, we do not guarantee
            uninterrupted availability, error-free automated results or
            suitability for a particular purpose, and are not responsible for
            indirect losses such as lost reach or expected earnings. Nothing in
            these terms excludes liability or consumer rights that the law does
            not allow us to exclude.
          </p>
          <p>
            If there is a problem with your account, credits, content or another
            person’s rights,{" "}
            <Link href="/contact">contact the administrator</Link> with enough
            detail to investigate. Do not include your password or API keys. We
            may need to verify ownership before changing an account or acting on
            a content request.
          </p>
        </section>
        <section>
          <h2>Changes to these terms</h2>
          <p>
            We may update these terms as the service changes. The date above
            shows the latest revision. Material changes will be communicated
            through the service or account email as appropriate; new payment
            conditions will be shown before a real purchase. These terms do not
            override rights you have under applicable law.
          </p>
        </section>
      </article>
    </PublicPage>
  );
}
