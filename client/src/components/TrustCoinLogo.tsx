"use client";

import Link from "next/link";
import { useId } from "react";

type LogoSize = "sm" | "md" | "lg";

const MARK_SIZES: Record<LogoSize, number> = {
  sm: 32,
  md: 36,
  lg: 40,
};

interface TrustCoinMarkProps {
  size?: LogoSize;
  className?: string;
}

/** Shared TrustCoin icon mark — coin + forex chart on cyan/red gradient. */
export function TrustCoinMark({ size = "md", className = "" }: TrustCoinMarkProps) {
  const gradientId = useId();
  const px = MARK_SIZES[size];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={px}
      height={px}
      fill="none"
      aria-hidden
      className={`shrink-0 drop-shadow-[0_0_28px_rgba(34,211,238,0.35)] ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${gradientId})`} />
      <circle cx="20" cy="20" r="11.5" stroke="#041016" strokeWidth="2.2" opacity="0.92" />
      <circle cx="20" cy="20" r="7.5" fill="#041016" opacity="0.88" />
      <path
        d="M9.5 27.5 14.5 22.5 18.5 24.5 25 15.5 30.5 18.5"
        stroke="#67e8f9"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 14.5H24M20 14.5V18.5" stroke="#67e8f9" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface TrustCoinLogoProps {
  href?: string;
  name?: string;
  subtitle?: string;
  showName?: boolean;
  size?: LogoSize;
  className?: string;
}

/** Unified TrustCoin wordmark used across landing, auth, app, and admin headers. */
export function TrustCoinLogo({
  href,
  name = "TrustCoin",
  subtitle,
  showName = true,
  size = "md",
  className = "",
}: TrustCoinLogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <TrustCoinMark size={size} />
      {showName ? (
        subtitle ? (
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-white">{name}</span>
            <span className="block text-[11px] leading-tight text-slate-400">{subtitle}</span>
          </span>
        ) : (
          <span className="text-lg font-semibold tracking-tight text-white">{name}</span>
        )
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
