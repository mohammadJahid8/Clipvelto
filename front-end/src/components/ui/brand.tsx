import Image from "next/image";
import Link from "next/link";

export function Brand({
  compact = false,
  href = "/",
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link className="brand" href={href} aria-label="Clipvelto home">
      <Image src="/logo.svg" alt="" width={32} height={32} />
      {!compact && <span>Clipvelto</span>}
    </Link>
  );
}
