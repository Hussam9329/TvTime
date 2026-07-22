import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

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
    default: "TvTime — Movies, TV Shows & Anime",
    template: "%s — TvTime",
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
    "tv time",
  ],
  authors: [{ name: "TvTime" }],
  creator: "TvTime",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TvTime", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/placeholder-poster.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "TvTime",
    title: "TvTime — Movies, TV Shows & Anime",
    description:
      "Your personal cinema companion with separate spaces for movies, TV shows, anime, and Arabic content.",
    images: [
      {
        url: "/placeholder-poster.svg",
        width: 1200,
        height: 630,
        alt: "TvTime",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TvTime — Movies, TV Shows & Anime",
    description:
      "Your personal cinema companion with separate spaces for movies, TV shows, anime, and Arabic content.",
    images: ["/placeholder-poster.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
