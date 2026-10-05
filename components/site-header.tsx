"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, Plus, Radar } from "lucide-react";
import { usePathname } from "next/navigation";
export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
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
            <b>RecruitDrop</b> <span className="brand-subtitle">Cornell career radar</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary">
          {nav.filter(n => n.href !== "/submit").map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={pathname === n.href ? "active" : ""}
              aria-current={pathname === n.href ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="top-actions">
          <Link href="/submit" className="submit-link">
            <Plus size={17} /> Submit event
          </Link>
          <button className="mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu size={21} />
          </button>
        </div>
      </div>
      {menuOpen && <nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile">{nav.map((item) => <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}</nav>}
    </header>
  );
}
