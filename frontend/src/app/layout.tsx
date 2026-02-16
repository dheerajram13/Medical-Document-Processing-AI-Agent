import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medical Document AI - Processing & Extraction",
  description: "AI-powered medical document processing and extraction system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
