import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import AppFooter from "@/components/AppFooter";
import { DEFAULT_OG_IMAGE, DEFAULT_SITE_URL } from "@/lib/shareMetadataConstants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(DEFAULT_SITE_URL),
  title: "CourtShare - Book Premium Tennis Courts",
  icons: {
    icon: "/icon.png",
  },
  description:
    "Discover and book premium tennis courts in your area. Find courts close to you, book instantly, and play on the best courts available.",
  openGraph: {
    title: "CourtShare - Book Premium Tennis Courts",
    description:
      "Discover and book premium tennis courts in your area. Find courts close to you, book instantly, and play on the best courts available.",
    type: "website",
    url: "/",
    siteName: "CourtShare",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "CourtShare - Book premium tennis courts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CourtShare - Book Premium Tennis Courts",
    description: "Discover and book premium tennis courts in your area.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <AppFooter />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
