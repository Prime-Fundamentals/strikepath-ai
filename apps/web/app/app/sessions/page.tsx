"use client";

import { useEffect, useMemo, useState } from "react";
import { SessionTable } from "@/components/SessionTable";
import { apiFetch } from "@/lib/api";
import type { Session } from "@/lib/types";

type Filter = "all" | "active" | "completed";

export default function SessionsPage() {
  const [data, setData] = useState<Session[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Session[]>("/api/sessions")
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load sessions"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? data : data.filter((session) => session.status === filter)),
    [data, filter],
  );

  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow small">Bowling history</span>
          <h1>Sessions</h1>
          <p>Review every center, pattern, lane, and recorded shot.</p>
        </div>
        <div className="segmented" role="group" aria-label="Filter sessions">
          {(["all", "active", "completed"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "active" : ""}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      <section className="glass-panel table-panel">
        <div className="panel-heading">
          <div>
            <small>SESSION ARCHIVE</small>
            <h2>{loading ? "Loading sessions…" : `${filtered.length} recorded sessions`}</h2>
          </div>
        </div>
        {!loading && <SessionTable sessions={filtered} />}
      </section>
    </div>
  );
}
