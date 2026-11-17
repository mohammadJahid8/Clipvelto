"use client";
import Image from "next/image";
import { useState } from "react";
import { UserRound } from "lucide-react";

export function UserAvatar({
  name,
  image,
  size = "small",
}: {
  name: string;
  image?: string | null;
  size?: "small" | "profile";
}) {
  const [failed, setFailed] = useState<string | null>(null);
  let source: string | null = null;
  try {
    const url = new URL(image ?? "");
    if (url.protocol === "https:" && !url.username && !url.password)
      source = url.href;
  } catch {
    /* Missing or invalid photos fall back to the account's initials. */
  }
  const initials = name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => [...part][0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span
      className={`user-avatar${size === "profile" ? " user-avatar-profile" : ""}`}
      aria-hidden="true"
    >
      {source && source !== failed ? (
        <Image
          src={source}
          unoptimized
          width={size === "profile" ? 64 : 34}
          height={size === "profile" ? 64 : 34}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(source)}
        />
      ) : (
        initials || <UserRound size={20} />
      )}
    </span>
  );
}
