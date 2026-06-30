"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icons";
import type { Handedness } from "@/lib/types";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [handedness, setHandedness] = useState<Handedness>("right");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name);
    setHandedness(user.handedness);
  }, [user]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await updateProfile({ display_name: displayName.trim(), handedness });
      setMessage("Profile saved. Live Session and AR Tracking now use this handedness immediately.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow small"><Icon name="profile" width={16} />Bowler profile</span>
          <h1>Profile and lane orientation</h1>
          <p>Your bowling hand controls board numbering, default lines, pocket placement, recommendations, and AR board estimates.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <div className="profile-grid">
        <form className="glass-panel profile-form" onSubmit={save}>
          <div className="panel-heading"><div><small>ACCOUNT</small><h2>Bowler settings</h2></div></div>
          <label className="field"><span>Display name</span><input required minLength={2} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="field"><span>Email</span><input value={user?.email || ""} readOnly aria-readonly="true" /></label>

          <div className="profile-hand-picker">
            <span>Bowling hand</span>
            <div>
              <button type="button" className={handedness === "right" ? "active" : ""} onClick={() => setHandedness("right")}>
                <strong>Right-handed</strong><small>Board 1 begins at the right gutter.</small>
              </button>
              <button type="button" className={handedness === "left" ? "active" : ""} onClick={() => setHandedness("left")}>
                <strong>Left-handed</strong><small>Board 1 begins at the left gutter.</small>
              </button>
            </div>
          </div>

          <div className="profile-coordinate-note">
            <Icon name="target" width={20} />
            <p><strong>Safe historical conversion:</strong> StrikePath stores lane locations in one physical coordinate system and mirrors only the displayed board numbers. Changing your bowling hand will not move or corrupt earlier shot paths.</p>
          </div>

          <button className="primary-button wide" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        </form>

        <aside className="glass-panel profile-preview">
          <div className="panel-heading"><div><small>ACTIVE VIEW</small><h2>{handedness === "left" ? "Left-handed" : "Right-handed"} numbering</h2></div></div>
          <div className={`profile-lane-preview ${handedness}`}>
            {[39,35,30,25,20,15,10,5,1].map((physical) => {
              const display = handedness === "left" ? 40 - physical : physical;
              return <span key={physical}>{display}</span>;
            })}
          </div>
          <p>These are the same board numbers you will see in the Live Session form, interactive lane, shot history, recommendations, and AR telemetry.</p>
          <Link href="/app/guides" className="secondary-button wide"><Icon name="guide" width={18} />Open board-numbering guide</Link>
        </aside>
      </div>
    </div>
  );
}
