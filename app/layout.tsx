import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
  },
  twitter: {
    card: "summary_large_image",
    title: "CourtShare - Book Premium Tennis Courts",
    description: "Discover and book premium tennis courts in your area.",
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
