import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteConfigProvider } from "@/components/SiteConfigProvider";
import { AuctionProvider } from "@/components/AuctionProvider";
import { getSiteConfigServer } from "@/lib/siteConfigServer";
import { Header } from "@/components/Header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfigServer();

  return {
    title: site.eventTitle || "Silent Auction",
    description: site.orgName ? `A charity silent auction by ${site.orgName}.` : "A charity silent auction.",
    icons: site.faviconUrl ? [{ rel: "icon", url: site.faviconUrl }] : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <SiteConfigProvider>
            <AuctionProvider>
              <Header />
              {children}
            </AuctionProvider>
          </SiteConfigProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
