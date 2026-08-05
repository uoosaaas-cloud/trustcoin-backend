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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://trustcoin.cc";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TrustCoin — Forex Trading & Investment by AXS",
    template: "%s | TrustCoin",
  },
  description:
    "TrustCoin is an AXS-powered forex trading and investment platform. Deposit USDT, choose a package, follow live trading signals, and track returns in English or Arabic.",
  keywords: [
    "TrustCoin",
    "forex trading",
    "AXS",
    "investment packages",
    "trading robot",
    "تداول فوركس",
    "استثمار",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA"],
    url: SITE_URL,
    siteName: "TrustCoin",
    title: "TrustCoin — Forex Trading & Investment by AXS",
    description:
      "Secure forex investment packages powered by AXS. Register, deposit, invest, and follow live trading signals.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrustCoin — Forex Trading & Investment by AXS",
    description:
      "Secure forex investment packages powered by AXS. Register, deposit, invest, and follow live trading signals.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: [{ url: "/logo-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo-icon.svg", type: "image/svg+xml" }],
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
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
      <body className="min-h-full bg-[#071018] font-sans text-slate-100 antialiased">
        <ClientIntlProvider initialLocale={locale}>
          <Providers>{children}</Providers>
        </ClientIntlProvider>
      </body>
    </html>
  );
}
