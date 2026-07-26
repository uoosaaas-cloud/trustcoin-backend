"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AboutPlatformModal } from "@/components/AboutPlatformModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface AuthChromeHeaderProps {
  brandHref?: string;
}

/** Shared header for login/register with About Us + language switcher. */
export function AuthChromeHeader({ brandHref = "/" }: AuthChromeHeaderProps) {
  const t = useTranslations("nav");
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href={brandHref} className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-gold-500 text-lg font-bold text-white shadow-lg shadow-brand-500/25">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">TrustCoin</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="rounded-xl border border-blue-200/70 bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-1.5 text-xs font-semibold text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.18)] transition hover:border-blue-300 sm:text-sm"
          >
            {t("about")}
          </button>
          <LanguageSwitcher />
        </div>
      </header>
      <AboutPlatformModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
