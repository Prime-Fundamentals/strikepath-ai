"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "./AuthProvider";
import { Icon } from "./Icons";

const nav = [
  { href: "/app", label: "Dashboard", icon: "dashboard" },
  { href: "/app/live", label: "Live Session", icon: "live" },
  { href: "/app/arsenal", label: "Ball Arsenal", icon: "ball" },
  { href: "/app/sessions", label: "Sessions", icon: "sessions" },
  { href: "/app/analytics", label: "Analytics", icon: "analytics" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [online, setOnline] = useState(true);

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

  if (loading || !user) return <div className="full-loader"><span className="loader-ring" /><p>Loading StrikePath AI…</p></div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/app" className="sidebar-brand">
          <span className="brand-orbit"><span className="brand-ball" /></span>
          <span><strong>STRIKEPATH</strong><em>AI</em><small>Lane Intelligence</small></span>
        </Link>
        <nav className="side-nav">
          {nav.map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""}>
                <Icon name={item.icon} width={21} height={21} />
                <span>{item.label}</span>
                {active && <span className="nav-glow" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className={`connection-pill ${online ? "online" : "offline"}`}><Icon name="wifi" width={16} />{online ? "Online" : "Offline mode"}</div>
          <button type="button" className="profile-button" onClick={logout}>
            <span className="avatar">{user.display_name.slice(0, 1).toUpperCase()}</span>
            <span><strong>{user.display_name}</strong><small>{user.handedness}-handed</small></span>
            <Icon name="logout" width={18} />
          </button>
        </div>
      </aside>
      <main className="app-main">
        <header className="mobile-header">
          <Link href="/app" className="mobile-brand">STRIKEPATH <em>AI</em></Link>
          <span className={`status-dot ${online ? "online" : "offline"}`} />
        </header>
        {children}
        <nav className="mobile-nav">
          {nav.slice(0, 5).map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon name={item.icon} width={21} /><small>{item.label.split(" ")[0]}</small></Link>;
          })}
        </nav>
      </main>
    </div>
  );
}
