import { CreditPackCards } from "@/components/billing/credit-pack-cards";
export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section
      id="pricing"
      tabIndex={-1}
      className="pricing-section section"
      aria-labelledby="pricing-title"
    >
      <div className="container">
        <div className="section-heading">
          <h2 id="pricing-title">Pay for the video minutes you need.</h2>
          <p>Start free. Add credits anytime, with no subscription.</p>
        </div>
        <CreditPackCards signedIn={signedIn} includeFree />
        <p className="pricing-note">
          1 credit = 1 source-video minute, with a 1-credit minimum per video.
          Large-file storage minimum: 2 credits per GB for 30 days; the higher
          quote applies. Credits never expire. New media is kept for 30 days.
          Purchases are currently available in the development payment
          simulator; live payments are coming later.
        </p>
      </div>
    </section>
  );
}
