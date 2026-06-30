"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { useAuth } from "@/components/AuthProvider";
import { bowlingGuides, guideCategories, type GuideCategory } from "@/lib/guides";
import { handLabel } from "@/lib/boards";

export default function GuidesPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GuideCategory | "All">("All");
  const [openId, setOpenId] = useState<string | null>("board-numbering");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bowlingGuides.filter((guide) => {
      const categoryMatch = category === "All" || guide.category === category;
      const queryMatch = !normalized || `${guide.title} ${guide.summary} ${guide.category} ${guide.steps.join(" ")}`.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
  }, [query, category]);

  return (
    <div className="page-content guides-page">
      <div className="page-heading guides-heading">
        <div>
          <span className="eyebrow small"><Icon name="guide" width={16} />Guides and tips</span>
          <h1>Learn the lane faster</h1>
          <p>Practical bowling, targeting, spare, AR, and mobile-use guides. Your active profile is <strong>{handLabel(user?.handedness || "right")}</strong>.</p>
        </div>
      </div>

      <section className="glass-panel guides-toolbar">
        <label className="guide-search"><Icon name="target" width={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guides, leaves, arrows, AR setup…" /></label>
        <div className="guide-category-tabs">
          <button type="button" className={category === "All" ? "active" : ""} onClick={() => setCategory("All")}>All</button>
          {guideCategories.map((item) => <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      </section>

      <div className="guides-layout">
        <section className="guide-list">
          {filtered.map((guide) => {
            const open = openId === guide.id;
            return (
              <article key={guide.id} className={`glass-panel guide-card ${open ? "open" : ""}`}>
                <button type="button" className="guide-card-header" onClick={() => setOpenId(open ? null : guide.id)} aria-expanded={open}>
                  <span className="guide-card-icon"><Icon name={guide.category === "AR tracking" ? "camera" : guide.category === "Mobile setup" ? "phone" : "guide"} width={21} /></span>
                  <span className="guide-card-title"><small>{guide.category} • {guide.level} • {guide.duration}</small><strong>{guide.title}</strong><p>{guide.summary}</p></span>
                  <Icon name="chevron" width={20} className="guide-chevron" />
                </button>
                {open && <div className="guide-card-body"><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol><div className="guide-tip"><Icon name="spark" width={18} /><p><strong>Coach tip</strong>{guide.tip}</p></div></div>}
              </article>
            );
          })}
          {!filtered.length && <div className="glass-panel guide-empty"><Icon name="guide" width={28} /><h2>No matching guides</h2><p>Try a different search term or choose another category.</p></div>}
        </section>

        <aside className="guides-side">
          <section className="glass-panel quick-reference">
            <small>QUICK REFERENCE</small>
            <h2>{user?.handedness === "left" ? "Left-handed" : "Right-handed"} board count</h2>
            <div className={`quick-board-row ${user?.handedness === "left" ? "left" : "right"}`}>
              {[39,35,30,25,20,15,10,5,1].map((physical) => <span key={physical}>{user?.handedness === "left" ? 40 - physical : physical}</span>)}
            </div>
            <p>Read from your bowling-hand gutter toward the opposite side. Board 20 is the center board in either display.</p>
          </section>
          <section className="glass-panel quick-reference">
            <small>LANE TARGETS</small>
            <h2>Common five-board marks</h2>
            <div className="quick-target-list"><span><b>5</b>First arrow</span><span><b>10</b>Second arrow</span><span><b>15</b>Third arrow</span><span><b>20</b>Center arrow</span></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
