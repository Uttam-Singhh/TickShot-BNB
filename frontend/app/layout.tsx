import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TickShot BNB - Parimutuel Price Prediction",
  description: "Bet on BNB/USD price direction. 2-minute rounds. Winners split the pool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-[#0a0a1a] text-white min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
