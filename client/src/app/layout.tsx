import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { Providers } from "@/components/Providers";
import { ClientIntlProvider } from "@/components/ClientIntlProvider";
import { defaultLocale, isRtl } from "@/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TrustCoin — Forex Trading & Investment by AXS",
  description:
    "Officially presented by AXS. Secure forex packages, live trading signals, and daily yield distribution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = defaultLocale;
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} h-full`}
    >
      <body className="min-h-full bg-[#F6F7FB] font-sans text-slate-900 antialiased">
        <ClientIntlProvider initialLocale={locale}>
          <Providers>{children}</Providers>
        </ClientIntlProvider>
      </body>
    </html>
  );
}
