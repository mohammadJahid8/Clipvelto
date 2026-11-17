import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { creditPacks, type CreditPackId } from "@clipvelto/credit-plans";
export function CreditPackCards({
  onChoose,
  signedIn = false,
  disabled = false,
  includeFree = false,
}: {
  onChoose?: (id: CreditPackId) => void;
  signedIn?: boolean;
  disabled?: boolean;
  includeFree?: boolean;
}) {
  return (
    <div
      className={`credit-pack-grid${includeFree ? " credit-pack-grid-four" : ""}`}
    >
      {includeFree && (
        <article className="credit-pack">
          <div className="credit-pack-title">
            <h3>Free</h3>
            <span>Try Clipvelto</span>
          </div>
          <p className="credit-pack-price">
            $0<span>to get started</span>
          </p>
          <p>
            <strong>15 credits</strong> · once per account
          </p>
          <PackFeatures />
          <p className="credit-pack-note">
            Your homepage preview uses the same free credits.
          </p>
          <Link
            className="button button-secondary"
            href={signedIn ? "/dashboard" : "/sign-up"}
          >
            {signedIn ? "Open workspace" : "Start free"}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </article>
      )}
      {creditPacks.map((pack) => (
        <article
          className={`credit-pack${pack.recommended ? " recommended" : ""}`}
          key={pack.id}
        >
          <div className="credit-pack-title">
            <h3>{pack.name}</h3>
            {pack.recommended && <span>Best for regular creators</span>}
          </div>
          <p className="credit-pack-price">
            ${pack.priceCents / 100}
            <span>one time · plus applicable tax</span>
          </p>
          <p>
            <strong>{pack.credits} credits</strong> · up to {pack.credits / 60}{" "}
            hours of video
          </p>
          <PackFeatures />
          <p className="credit-pack-note">Unused credits never expire.</p>
          {onChoose ? (
            <button
              type="button"
              className={`button button-${pack.recommended ? "primary" : "secondary"}`}
              disabled={disabled}
              onClick={() => onChoose(pack.id)}
            >
              Choose {pack.name}
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <Link
              className={`button button-${pack.recommended ? "primary" : "secondary"}`}
              href={signedIn ? "/dashboard/billing" : "/sign-up"}
            >
              Choose {pack.name}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}

function PackFeatures() {
  return (
    <ul>
      {[
        "Vertical, horizontal & square clips",
        "Optional captions",
        "Private MP4 downloads",
        "Up to 1080p, based on your source",
      ].map((feature) => (
        <li key={feature}>
          <Check size={18} aria-hidden="true" />
          {feature}
        </li>
      ))}
    </ul>
  );
}
