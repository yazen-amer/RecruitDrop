"use client";
import Link from "next/link";
import { Bell, Bookmark, Menu, Plus, Radar } from "lucide-react";
import { usePathname } from "next/navigation";
export function SiteHeader() {
  const pathname = usePathname();
  const nav = [
    { href: "/", label: "Discover" },
    { href: "/saved", label: "Saved" },
    { href: "/alerts", label: "Alerts" },
    { href: "/submit", label: "Submit an event" },
  ];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" aria-label="Home">
          <span className="brand-mark">
            <Radar size={18} />
          </span>
          <span>
            <b>Cornell</b> Recruiting Radar
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={pathname === n.href ? "active" : ""}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="top-actions">
          <Link href="/alerts" className="icon-link" aria-label="Personalized alerts"><Bell size={18} /></Link>
          <Link href="/saved" className="icon-link" aria-label="Saved events">
            <Bookmark size={19} />
          </Link>
          <Link href="/submit" className="submit-link">
            <Plus size={17} /> Submit event
          </Link>
          <button className="mobile-menu" aria-label="Open menu">
            <Menu size={21} />
          </button>
        </div>
      </div>
    </header>
  );
}
