"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AboutPlatformModal } from "@/components/AboutPlatformModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TrustCoinLogo } from "@/components/TrustCoinLogo";

interface AuthChromeHeaderProps {
  brandHref?: string;
}

/** Shared header for login/register with About Us + language switcher. */
export function AuthChromeHeader({ brandHref = "/" }: AuthChromeHeaderProps) {
  const t = useTranslations("nav");
  const tBrand = useTranslations("brand");
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <TrustCoinLogo href={brandHref} name={tBrand("name")} />
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-white/10 sm:text-sm"
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
