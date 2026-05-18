import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import { Providers } from "@/components/providers";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sign in — Smart Plumbing",
  description:
    "Access your jobs, invoices, and customer records with Smart Plumbing.",
  manifest: "/manifest.webmanifest",
  applicationName: "Smart Plumbing Client",
  appleWebApp: {
    capable: true,
    title: "Smart Plumbing Client",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
