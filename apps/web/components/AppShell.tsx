"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "./AuthProvider";
import { Icon } from "./Icons";

const nav = [
  { href: "/app", label: "Dashboard", icon: "dashboard" },
  { href: "/app/live", label: "Live Session", icon: "live" },
  { href: "/app/ar-tracking", label: "AR Tracking", icon: "camera" },
  { href: "/app/guides", label: "Guides & Tips", icon: "guide" },
  { href: "/app/arsenal", label: "Ball Arsenal", icon: "ball" },
  { href: "/app/sessions", label: "Sessions", icon: "sessions" },
  { href: "/app/analytics", label: "Analytics", icon: "analytics" },
  { href: "/app/profile", label: "Profile", icon: "profile" },
];

const mobilePrimary = nav.slice(0, 4);
const mobileMore = nav.slice(4);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [online, setOnline] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => setMoreOpen(false), [pathname]);

  if (loading || !user) return <div className="full-loader"><span className="loader-ring" /><p>Loading StrikePath AI…</p></div>;

  const isActive = (href: string) => href === "/app" ? pathname === "/app" : pathname.startsWith(href);
  const moreActive = mobileMore.some((item) => isActive(item.href));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/app" className="sidebar-brand">
          <span className="brand-orbit"><span className="brand-ball" /></span>
          <span><strong>STRIKEPATH</strong><em>AI</em><small>Lane Intelligence</small></span>
        </Link>
        <nav className="side-nav">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : ""}>
              <Icon name={item.icon} width={21} height={21} />
              <span>{item.label}</span>
              {isActive(item.href) && <span className="nav-glow" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className={`connection-pill ${online ? "online" : "offline"}`}><Icon name="wifi" width={16} />{online ? "Online" : "Offline mode"}</div>
          <Link href="/app/profile" className="profile-button">
            <span className="avatar">{user.display_name.slice(0, 1).toUpperCase()}</span>
            <span><strong>{user.display_name}</strong><small>{user.handedness}-handed</small></span>
            <Icon name="profile" width={18} />
          </Link>
          <button type="button" className="sidebar-logout" onClick={logout}><Icon name="logout" width={17} />Sign out</button>
        </div>
      </aside>

      <main className="app-main">
        <header className="mobile-header">
          <Link href="/app" className="mobile-brand">STRIKEPATH <em>AI</em></Link>
          <div className="mobile-header-status"><span className="mobile-hand-badge">{user.handedness === "left" ? "LH" : "RH"}</span><span className={`status-dot ${online ? "online" : "offline"}`} /></div>
        </header>
        {children}

        {moreOpen && (
          <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}>
            <section className="mobile-more-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="mobile-more-heading"><div><small>MORE</small><strong>{user.display_name}</strong><span>{user.handedness === "left" ? "Left-handed" : "Right-handed"} profile</span></div><button type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu"><Icon name="close" width={22} /></button></div>
              <nav>{mobileMore.map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : ""}><Icon name={item.icon} width={22} /><span>{item.label}</span><Icon name="chevron" width={18} /></Link>)}</nav>
              <button type="button" className="mobile-more-logout" onClick={logout}><Icon name="logout" width={18} />Sign out</button>
            </section>
          </div>
        )}

        <nav className="mobile-nav">
          {mobilePrimary.map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : ""}><Icon name={item.icon} width={21} /><small>{item.label.split(" ")[0]}</small></Link>)}
          <button type="button" className={moreOpen || moreActive ? "active" : ""} onClick={() => setMoreOpen((value) => !value)}><Icon name="menu" width={21} /><small>More</small></button>
        </nav>
      </main>
    </div>
  );
}
