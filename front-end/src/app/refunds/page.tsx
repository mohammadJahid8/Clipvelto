import Link from "next/link";
import { PublicPage } from "@/components/layout/public-page";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Refund policy",
  description:
    "Payment support, credit adjustments and refund requests for Clipvelto credit packs.",
  path: "/refunds",
});

export default function RefundsPage() {
  return (
    <PublicPage
      title="Refund policy"
      intro="Help with purchases, processing credits and payment issues."
      updated="17 November 2026"
    >
      <article className="public-prose">
        <section>
          <h2>Sandbox purchases</h2>
          <p>
            Checkout marked as sandbox or payment testing does not charge real
            money. Its credits are kept in a separate test balance. Refunding a
            test purchase does not transfer money.
          </p>
        </section>
        <section>
          <h2>Paid credit packs</h2>
          <p>
            When live Paddle checkout is enabled, Paddle acts as the reseller
            for purchases made through that checkout. Credit packs are one-time
            purchases, not subscriptions. Refund requests are handled under{" "}
            <a
              href="https://www.paddle.com/legal/refund-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Paddle’s refund policy
            </a>{" "}
            and applicable consumer rights.
          </p>
          <p>
            For a payment or refund request, use the support link in your Paddle
            receipt or visit{" "}
            <a
              href="https://paddle.net"
              target="_blank"
              rel="noopener noreferrer"
            >
              Paddle payment support
            </a>
            . You can also <Link href="/contact#top">contact Clipvelto</Link>{" "}
            with your account email and purchase reference. Do not send
            passwords or full card details.
          </p>
        </section>
        <section>
          <h2>What happens to credits</h2>
          <p>
            An approved refund removes the corresponding unused credits. Refunds
            involving credits already used or reserved, partial refunds and
            payment disputes may require account review. New processing can be
            restricted while the credit balance is reconciled.
          </p>
          <p>
            If a processing job fails, its processing reservation is returned
            according to our <Link href="/terms#top">terms</Link>. This restores
            service credits; it does not itself refund a payment. Deleting a
            completed video does not restore credits already used.
          </p>
        </section>
        <section>
          <h2>Your rights</h2>
          <p>
            This policy does not limit mandatory consumer rights or remedies for
            a service that is faulty or materially different from its
            description.
          </p>
        </section>
      </article>
    </PublicPage>
  );
}
