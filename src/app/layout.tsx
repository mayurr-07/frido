import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Frido — Product Intelligence & Prize Sticker Matching",
  description:
    "Internal Frido platform for deterministic Item Master CSV to prize sticker matching, manual review, auditing and PDF reporting.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#FAFAF8] font-sans text-[#171717] antialiased">
        {children}
      </body>
    </html>
  );
}
