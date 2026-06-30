import Link from "next/link";
import { Icon } from "@/components/Icons";
import { LandingLanePreview } from "@/components/LandingLanePreview";
import styles from "./landing.module.css";

const capabilities = [
  {
    icon: "live",
    title: "Live lane decisions",
    text: "Log the shot, see the line, and get a clear next-shot setup without digging through technical screens.",
  },
  {
    icon: "target",
    title: "Pin-specific spare planning",
    text: "StrikePath reads the exact leave and builds a practical second-ball line for the pins that remain.",
  },
  {
    icon: "camera",
    title: "Camera-assisted tracking",
    text: "Record or upload a shot, calibrate the lane, and review detected release, target, breakpoint, and pocket events.",
  },
  {
    icon: "ball",
    title: "Equipment-aware analysis",
    text: "Connect every result to the ball, surface, speed, and release information that shaped the reaction.",
  },
  {
    icon: "analytics",
    title: "Session intelligence",
    text: "Track strike rate, pocket rate, target accuracy, adjustment results, and performance by game.",
  },
  {
    icon: "wifi",
    title: "Bowling-center ready",
    text: "Use a phone, tablet, or laptop and keep logging even when the center connection is unreliable.",
  },
];

const steps = [
  ["01", "Set the lane", "Choose the center, lane, pattern, hand, and ball."],
  ["02", "Log the result", "Record the line, execution, speed, and pins left standing."],
  ["03", "Review the setup", "See the recommended feet, target, speed, equipment, and spare plan."],
  ["04", "Confirm the reaction", "The next shot updates the recommendation using your actual outcome."],
];

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="StrikePath AI home">
          <span className={styles.brandMark} aria-hidden="true"><span /></span>
          <span className={styles.brandText}><strong>StrikePath</strong><em>AI</em></span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#workflow">Workflow</a>
          <a href="#tracking">AR tracking</a>
        </nav>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.signIn}>Sign in</Link>
          <Link href="/register" className={styles.navCta}>Start free</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <video className={styles.heroVideo} autoPlay muted loop playsInline poster="/logo.jpg" aria-hidden="true">
          <source src="/introloop.mp4" type="video/mp4" />
        </video>
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}><i /> Bowling intelligence for every frame</span>
            <h1>See the reaction.<br /><span>Make the next shot.</span></h1>
            <p>
              StrikePath AI turns shot results, lane position, equipment, and pin leaves into a practical setup you can use before the next delivery.
            </p>
            <div className={styles.heroActions}>
              <Link href="/register" className={styles.primaryCta}>Create your bowling profile <Icon name="chevron" width={18} /></Link>
              <Link href="/login" className={styles.secondaryCta}>Open dashboard</Link>
            </div>
            <div className={styles.heroProof}>
              <span><b>39-board</b> lane mapping</span>
              <span><b>Pin-specific</b> spare plans</span>
              <span><b>Phone-first</b> session logging</span>
            </div>
          </div>

          <div className={styles.productPreview} aria-label="StrikePath AI live session preview">
            <div className={styles.previewTop}>
              <span><i /> LIVE SESSION</span>
              <small>Lane 18 · House pattern</small>
            </div>
            <div className={styles.previewBody}>
              <LandingLanePreview />
              <div className={styles.previewRecommendation}>
                <small>NEXT SHOT</small>
                <h3>Move 2 boards inside, target 1 inside</h3>
                <p>The last two trusted deliveries finished high. Shift the line into more oil and verify the reaction with one controlled shot.</p>
                <div className={styles.previewMetrics}>
                  <span><small>Feet</small><strong>Board 32</strong></span>
                  <span><small>Target</small><strong>Board 15</strong></span>
                  <span><small>Confidence</small><strong>84%</strong></span>
                </div>
                <div className={styles.confidence}><span /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.assuranceBar} aria-label="Product principles">
        <span><Icon name="spark" width={18} /> Explainable recommendations</span>
        <span><Icon name="target" width={18} /> Left- and right-handed views</span>
        <span><Icon name="wifi" width={18} /> Offline shot queue</span>
        <span><Icon name="camera" width={18} /> Guided camera tracking</span>
      </section>

      <section id="platform" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span>One focused platform</span>
          <h2>Everything needed to read, adjust, and verify the lane.</h2>
          <p>Designed for bowlers, coaches, teams, and pro shops without turning the session into a spreadsheet.</p>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilities.map((item) => (
            <article key={item.title} className={styles.capabilityCard}>
              <span className={styles.capabilityIcon}><Icon name={item.icon} width={23} /></span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className={styles.workflowSection}>
        <div className={styles.workflowIntro}>
          <span>A workflow built for the next delivery</span>
          <h2>Less setup. More useful feedback.</h2>
          <p>Every screen is organized around what the bowler needs to do next, with detailed controls available only when they are needed.</p>
          <Link href="/register" className={styles.inlineLink}>Start a session <Icon name="chevron" width={17} /></Link>
        </div>
        <div className={styles.stepGrid}>
          {steps.map(([number, title, text]) => (
            <article key={number}>
              <b>{number}</b>
              <div><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section id="tracking" className={styles.trackingSection}>
        <div className={styles.trackingVisual}>
          <div className={styles.phoneFrame}>
            <div className={styles.phoneCamera}>
              <div className={styles.cameraLane} />
              <span className={styles.cornerOne} /><span className={styles.cornerTwo} /><span className={styles.cornerThree} /><span className={styles.cornerFour} />
              <svg viewBox="0 0 260 440"><path d="M 190 410 C 180 320 118 220 148 86" fill="none" stroke="#7df8ff" strokeWidth="5" strokeLinecap="round" /></svg>
              <div className={styles.cameraBadge}>Tracking confidence 82%</div>
            </div>
          </div>
        </div>
        <div className={styles.trackingCopy}>
          <span>Camera-assisted tracking</span>
          <h2>Bring the lane into the session.</h2>
          <p>Record or upload a delivery, calibrate the lane, and review detected release, arrow crossing, breakpoint, pocket entry, speed, and angle.</p>
          <div className={styles.trackingList}>
            <span><i /> Local browser-side analysis</span>
            <span><i /> Editable detections before saving</span>
            <span><i /> Mobile and tablet capture workflow</span>
          </div>
          <Link href="/register" className={styles.secondaryCta}>Explore AR tracking</Link>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <span>Ready for a clearer lane decision?</span>
          <h2>Build your first StrikePath session in minutes.</h2>
        </div>
        <div>
          <Link href="/register" className={styles.primaryCta}>Create account</Link>
          <Link href="/login" className={styles.secondaryCta}>Sign in</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.brand} aria-label="StrikePath AI home">
          <span className={styles.brandMark} aria-hidden="true"><span /></span>
          <span className={styles.brandText}><strong>StrikePath</strong><em>AI</em></span>
        </Link>
        <p>Dynamic lane tracking and optimization by Prime Fundamentals LLC.</p>
        <span>© 2026 Prime Fundamentals LLC</span>
      </footer>
    </main>
  );
}
