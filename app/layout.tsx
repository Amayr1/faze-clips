import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://overtime-esports-clips.civilbuddy259.chatgpt.site"),
  title: "FaZe Clips — Your era. Your next up.",
  description: "A HackUTA fan-platform prototype: discover clips, explore FaZe history, build your fan passport, and put your own moment in the spotlight.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
