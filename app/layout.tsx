import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
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
    "Play on your dream tennis court. Discover premium, private, tennis courts near you and book instantly.",
  openGraph: {
    title: "CourtShare - Book Premium Tennis Courts",
    description:
      "Play on your dream tennis court. Discover premium, private, tennis courts near you and book instantly.",
    type: "website",
    url: "/",
    siteName: "CourtShare",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "CourtShare - Book Premium Tennis Courts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CourtShare - Book Premium Tennis Courts",
    description: "Discover premium, private, tennis courts near you and book instantly.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // nonce is read here so it can be passed to any <Script nonce={nonce}> added later.
  // Do NOT put the nonce in DOM attributes — that exposes it to injection attacks.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  void nonce; // suppress unused-var until a Script component needs it
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
