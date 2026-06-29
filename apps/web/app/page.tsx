import Link from "next/link";
import { Icon } from "@/components/Icons";

const features = [
  ["live", "Live shot tracking", "Capture feet, target, breakpoint, speed, pocket result, and execution quality in seconds."],
  ["spark", "Explainable recommendations", "Get 1-and-1, 2-and-1, and larger moves with confidence and the reason behind every suggestion."],
  ["analytics", "Session intelligence", "Measure pocket rate, strike rate, target accuracy, transition, and adjustment success over time."],
  ["ball", "Equipment-aware history", "Track your arsenal, surfaces, coverstocks, and which ball performs best on each condition."],
  ["target", "Dynamic lane view", "Visualize the latest ball path, recent traffic, and an estimated friction map across 39 boards."],
  ["wifi", "Center-ready offline mode", "Keep logging at low-connectivity bowling centers and synchronize queued shots when service returns."],
];

export default function Home() {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <Link href="/" className="marketing-brand"><span className="brand-orbit small"><span className="brand-ball" /></span><strong>STRIKEPATH</strong><em>AI</em></Link>
        <nav><a href="#features">Features</a><a href="#workflow">How it works</a><Link href="/login">Sign in</Link><Link href="/register" className="nav-cta">Start free</Link></nav>
      </header>

      <section className="hero">
        <video className="hero-video" autoPlay muted loop playsInline poster="/logo.jpg"><source src="/introloop.mp4" type="video/mp4" /></video>
        <div className="hero-overlay" />
        <div className="hero-grid" />
        <div className="hero-content">
          <span className="eyebrow"><Icon name="spark" width={16}/>Bowling lane intelligence</span>
          <h1>Read the lane.<br/><span>Own the next shot.</span></h1>
          <p>StrikePath AI turns every delivery into a clear visual, an estimated transition model, and a practical next-shot adjustment.</p>
          <div className="hero-actions"><Link href="/register" className="primary-button">Build your first session <Icon name="chevron" width={18}/></Link><Link href="/login" className="secondary-button">Open dashboard</Link></div>
          <div className="trust-row"><span><b>39</b> lane boards</span><span><b>60 ft</b> vector model</span><span><b>Explainable</b> recommendations</span></div>
        </div>
        <div className="hero-panel glass-panel">
          <div className="mini-top"><span className="live-dot" />LIVE SESSION <small>Lane 18</small></div>
          <div className="mini-lane">
            {Array.from({length: 18}).map((_, i) => <i key={i}/>) }
            <svg viewBox="0 0 240 360"><path d="M175 335 C 160 270 88 170 128 30" fill="none" stroke="#00efff" strokeWidth="5"/><circle cx="175" cy="335" r="8" fill="#071827" stroke="#fff" strokeWidth="3"/><circle cx="128" cy="30" r="7" fill="#fff" stroke="#00efff" strokeWidth="3"/></svg>
          </div>
          <div className="mini-rec"><small>NEXT MOVE</small><strong>2 left with feet • 1 left target</strong><p>Two controlled shots finished high as the breakpoint moved earlier.</p><div><span style={{width:"82%"}} /></div></div>
        </div>
      </section>

      <section id="features" className="marketing-section">
        <div className="section-heading"><span>Built for useful decisions</span><h2>Every screen helps you make the next shot better.</h2><p>No black-box command. StrikePath shows what changed, why it matters, and how confident the system is.</p></div>
        <div className="feature-grid">{features.map(([icon,title,description]) => <article key={title} className="feature-card"><span><Icon name={icon} width={24}/></span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section id="workflow" className="workflow-section">
        <div className="section-heading left"><span>A simple lane workflow</span><h2>Log. Learn. Adjust. Verify.</h2></div>
        <div className="workflow-grid">
          {[["01","Start the session","Choose the center, lane, pattern, and ball."],["02","Log the delivery","Enter your line and mark whether execution was trustworthy."],["03","Review the recommendation","See the feet and target move with an explanation."],["04","Verify the reaction","The next shot teaches the model whether the move worked."]].map(([n,t,d]) => <article key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></article>)}
        </div>
      </section>

      <section className="cta-section"><img src="/logo.jpg" alt="StrikePath AI"/><div><span>Ready to see your lane differently?</span><h2>Start a session in under a minute.</h2><Link href="/register" className="primary-button">Create your account</Link></div></section>
      <footer className="marketing-footer"><span>© 2026 Prime Fundamentals LLC. All rights reserved.</span><span>StrikePath AI • Dynamic Lane Tracking & Optimization</span></footer>
    </main>
  );
}
