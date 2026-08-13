import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://tvtime-iota.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} — Movies, TV Shows & Anime`,
    template: `%s — ${APP_NAME}`,
  },
  description:
    "Your personal cinema companion with separate spaces for movies, TV shows, anime, and Arabic content. Track what you watch, rate what you love.",
  keywords: [
    "movies",
    "tv shows",
    "anime",
    "arabic movies",
    "arabic tv",
    "tracking",
    "cinema",
    "watchlist",
    "TMDB",
    "Trakora",
  ],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/logo.svg?v=4", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon.ico?v=4", sizes: "16x16 32x32 48x48" },
      { url: "/icon-192.png?v=4", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico?v=4",
    apple: "/apple-touch-icon.png?v=4",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: APP_NAME,
    title: `${APP_NAME} — Movies, TV Shows & Anime`,
    description:
      "Your personal cinema companion with separate spaces for movies, TV shows, anime, and Arabic content.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Track every story`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Movies, TV Shows & Anime`,
    description:
      "Your personal cinema companion with separate spaces for movies, TV shows, anime, and Arabic content.",
    images: ["/og-image.png"],
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: true,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
