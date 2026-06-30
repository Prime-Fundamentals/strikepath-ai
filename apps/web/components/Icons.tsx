import type { SVGProps } from "react";

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" /></>,
    live: <><path d="M12 3v4m0 10v4M3 12h4m10 0h4"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    ball: <><circle cx="12" cy="12" r="9"/><circle cx="9" cy="8" r="1" fill="currentColor"/><circle cx="13" cy="7" r="1" fill="currentColor"/><circle cx="12" cy="11" r="1" fill="currentColor"/></>,
    sessions: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    analytics: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></>,
    wifi: <><path d="M5 9a10 10 0 0 1 14 0M8 12a6 6 0 0 1 8 0m-5 3a2 2 0 0 1 2 0"/><circle cx="12" cy="18" r="1" fill="currentColor"/></>,
    chevron: <><path d="m9 6 6 6-6 6"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></>,
    camera: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6l1.5-2h5L16 6"/><circle cx="12" cy="13" r="4"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name] || paths.spark}
    </svg>
  );
}
