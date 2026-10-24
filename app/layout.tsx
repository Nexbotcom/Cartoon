import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Toon Studio",
  description: "2D cartoon video creator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
