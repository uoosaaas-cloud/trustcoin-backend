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
  title: "TrustCoin — Invest with Confidence",
  description:
    "TrustCoin is a secure, multilingual crypto investment platform. Create your account to start earning daily returns.",
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
