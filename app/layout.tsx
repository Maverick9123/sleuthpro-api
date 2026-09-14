import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Search Quest — Find People & Property",
  description:
    "Look up people and property by name, phone, email, or address. Public-record lookups for personal use.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}