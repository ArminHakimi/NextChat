import type { Metadata, Viewport } from "next";
import Link from "next/link";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./layout.css";

export const metadata: Metadata = {
  title: "NextChat",
  description: "simple chat app",
  applicationName: "NextChat",
  appleWebApp: {
    capable: true,
    title: "NextChat",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/pwa-icons/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/pwa-icons/180", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7a2830",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ServiceWorkerRegister />
        <nav className="navbar">
          <div className="nav-container">
            <h1 className="logo">NextChat</h1>
            <ul className="nav-links">
              <li>
                <Link href="/">Chat</Link>
              </li>
            </ul>
          </div>
        </nav>

        <main className="main-content">{children}</main>

        <footer className="footer">
          <p>NextChat built with Next.js and Socket.IO.</p>
        </footer>
      </body>
    </html>
  );
}
