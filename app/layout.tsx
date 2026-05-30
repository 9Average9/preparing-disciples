import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Preparing Disciples",
  description: "From study to sermon. Every word yours.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-bg-base text-text-primary antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
