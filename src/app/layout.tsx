import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { PwaRegister } from "@/components/pwa-register";
import { SyncInit } from "@/components/sync-init";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// Bump this on every future icon change — Safari's home-screen icon cache in
// particular ignores normal HTTP cache headers and largely only re-fetches
// when the URL itself changes. Query-string versioning is the standard,
// simplest way to force that without renaming every reference each time.
const ICON_VERSION = "2";
const iconUrl = (path: string) => `${path}?v=${ICON_VERSION}`;

export const metadata: Metadata = {
  // app.galeyar.ir is the livestock-management application itself (private,
  // authenticated content) — galeyar.ir is reserved for a future separate
  // public marketing site. robots below keeps this domain out of search
  // results; metadataBase/openGraph still point here so shared links and
  // relative asset URLs resolve correctly.
  metadataBase: new URL("https://app.galeyar.ir"),
  title: "گله‌یار | دستیار هوشمند مدیریت دامداری",
  description: "دستیار هوشمند مدیریت دامداری",
  applicationName: "گله‌یار",
  manifest: iconUrl("/manifest.webmanifest"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "گله‌یار | دستیار هوشمند مدیریت دامداری",
    description: "دستیار هوشمند مدیریت دامداری",
    url: "https://app.galeyar.ir",
    siteName: "گله‌یار",
    locale: "fa_IR",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "گله‌یار",
  },
  icons: {
    icon: [
      { url: iconUrl("/icons/favicon-16.png"), sizes: "16x16", type: "image/png" },
      { url: iconUrl("/icons/favicon-32.png"), sizes: "32x32", type: "image/png" },
      { url: iconUrl("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: iconUrl("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: iconUrl("/icons/favicon-32.png") }],
    apple: [{ url: iconUrl("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1B5E20",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
            <PwaRegister />
            <SyncInit />
            <Toaster position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
