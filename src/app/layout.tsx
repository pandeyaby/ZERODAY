import type { Metadata } from "next";
import { JetBrains_Mono, Oxanium, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Oxanium({
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ZERODAY — Agent Operator",
  description:
    "Keyless defensive vulnerability localization: ranks the files a human should review for a CWE, CVE or GHSA, with SARIF and verifiable evidence. Independent open source; no exploits.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} ${display.variable} ${mono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
