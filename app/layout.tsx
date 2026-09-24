import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SavedProvider } from "@/components/saved-provider";

export const metadata: Metadata = {
  title: "Cornell Recruiting Radar",
  description:
    "Recruiting events, info sessions, coffee chats, and deadlines for Cornell students.",
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
      <body>
        <SavedProvider>
          <SiteHeader />
          <main className="site-shell">{children}</main>
          <footer>
            <div>
              <b>Cornell Recruiting Radar</b>
              <span>Built for students who hate finding out late.</span>
            </div>
            <p>
              Independent student project. Always verify details with the
              original source.
            </p>
          </footer>
        </SavedProvider>
      </body>
    </html>
  );
}
