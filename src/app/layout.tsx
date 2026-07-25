import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal Pendaftaran Lomba Kemerdekaan Seion 2026",
  description: "Portal Pendaftaran Lomba HUT RI Ke-81 Cluster Mizu & B9–B10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
