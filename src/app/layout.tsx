import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Manrope, Yellowtail } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Marketing-site typefaces only (kept separate from the Geist pair the internal
// staff/portal app already uses, so this doesn't touch that app's look).
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

// Brush-script accent that echoes the "Envíos" flourish in the ShopUSA logo.
const yellowtail = Yellowtail({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "ShopUSA — Personal Shopper y Courier a Panamá y Ecuador",
    template: "%s · ShopUSA",
  },
  description:
    "Compra en tiendas de Estados Unidos y recíbelo en Panamá o Ecuador. Casillero en Miami, personal shopper, envíos por libra y portal de cliente con rastreo en tiempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${manrope.variable} ${yellowtail.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
