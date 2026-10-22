import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Almost — the party game of near-miss words",
  description:
    "One player gets a word that is almost right. A party game where every decoy is the nearest neighbour of the real word in Appwrite VectorsDB.",
  openGraph: {
    title: "Almost — the party game of near-miss words",
    description:
      "A social deduction game powered by vector similarity. Built on Appwrite VectorsDB.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2ece0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
