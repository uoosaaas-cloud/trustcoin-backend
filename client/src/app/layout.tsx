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
    default: "TrustCoin — Invest with Confidence",
    template: "%s | TrustCoin",
  },
  description:
    "TrustCoin is a secure, multilingual crypto investment platform. Deposit USDT, choose an investment package, and track daily returns in English or Arabic.",
  keywords: [
    "TrustCoin",
    "crypto investment",
    "USDT",
    "investment packages",
    "daily returns",
    "استثمار كريبتو",
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
    title: "TrustCoin — Invest with Confidence",
    description:
      "Secure USDT investment packages with transparent returns. Register, deposit, invest, and grow your capital.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrustCoin — Invest with Confidence",
    description:
      "Secure USDT investment packages with transparent returns. Register, deposit, invest, and grow your capital.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
