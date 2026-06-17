import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WanderKit Studio",
  description: "Creator Studio for publishing self-guided city tours."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

