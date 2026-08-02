import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal AI Assistant",
  description: "DeepSeek-powered assistant with memory and web search",
  applicationName: "Personal AI Assistant",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "AI Assistant",
    statusBarStyle: "black-translucent",
    startupImage: [
      { url: "/splash-iphone-se.png", media: "(device-width: 375px) and (device-height: 667px)" },
      { url: "/splash-iphone-8-plus.png", media: "(device-width: 414px) and (device-height: 736px)" },
      { url: "/splash-iphone-x.png", media: "(device-width: 375px) and (device-height: 812px)" },
      { url: "/splash-iphone-xs-max.png", media: "(device-width: 414px) and (device-height: 896px)" },
      { url: "/splash-iphone-xr.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" },
      { url: "/splash-iphone-12-13-14.png", media: "(device-width: 390px) and (device-height: 844px)" },
      { url: "/splash-iphone-12-13-14-pro-max.png", media: "(device-width: 428px) and (device-height: 926px)" },
      { url: "/splash-iphone-14-15-pro.png", media: "(device-width: 393px) and (device-height: 852px)" },
      { url: "/splash-iphone-14-15-pro-max.png", media: "(device-width: 430px) and (device-height: 932px)" },
      { url: "/splash-iphone-16-pro-max.png", media: "(device-width: 440px) and (device-height: 956px)" },
      { url: "/splash-ipad-11.png", media: "(device-width: 834px) and (device-height: 1194px)" },
      { url: "/splash-ipad-12-9.png", media: "(device-width: 1024px) and (device-height: 1366px)" },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}