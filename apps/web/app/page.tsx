import Link from "next/link";
import { Icon } from "@/components/Icons";
import styles from "./landing.module.css";

const capabilities = [
  {
    icon: "live",
    title: "Live lane decisions",
    text: "Log the result and get a clear next-shot setup without digging through technical screens.",
  },
  {
    icon: "target",
    title: "Pin-specific spare planning",
    text: "StrikePath reads the exact leave and builds a practical second-ball plan for the pins that remain.",
  },
  {
    icon: "camera",
    title: "Camera-assisted tracking",
    text: "Record or upload a shot and review detected release, target, breakpoint, speed, and pocket events.",
  },
  {
    icon: "ball",
    title: "Equipment-aware analysis",
    text: "Connect each result to the ball, surface, speed, release, and pattern that shaped the reaction.",
  },
  {
    icon: "analytics",
    title: "Session intelligence",
    text: "Track pocket rate, strike rate, target accuracy, adjustment results, and performance by game.",
  },
  {
    icon: "wifi",
    title: "Bowling-center ready",
    text: "Use a phone, tablet, or laptop and keep logging even when the center connection is unreliable.",
  },
];

const steps = [
  ["01", "Set the session", "Choose the center, lane condition, hand, and ball."],
  ["02", "Log the result", "Record execution, speed, and the exact pins left standing."],
  ["03", "Review the plan", "See the recommended feet, target, speed, ball, and spare plan."],
  ["04", "Confirm the reaction", "The next delivery updates the recommendation from the real outcome."],
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
          <a href="#tracking">Tracking</a>
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
            <h1>Read the result.<br /><span>Own the next shot.</span></h1>
            <p>
              StrikePath AI turns shot results, equipment, speed, lane position, and pin leaves into an understandable plan you can use before the next delivery.
            </p>
            <div className={styles.heroActions}>
              <Link href="/register" className={styles.primaryCta}>Create your bowling profile <Icon name="chevron" width={18} /></Link>
              <Link href="/login" className={styles.secondaryCta}>Open dashboard</Link>
            </div>
            <div className={styles.heroProof}>
              <span><b>Explainable</b> recommendations</span>
              <span><b>Pin-specific</b> spare plans</span>
              <span><b>Phone-first</b> session logging</span>
            </div>
          </div>

          <div className={styles.coachConsole} aria-label="StrikePath AI recommendation preview">
            <div className={styles.consoleHeader}>
              <div>
                <span className={styles.consoleLive}><i /> LIVE COACH</span>
                <strong>Next-shot decision</strong>
              </div>
              <small>Updated from shot #18</small>
            </div>

            <div className={styles.reactionCard}>
              <div>
                <small>LAST RESULT</small>
                <h3>High pocket hit</h3>
                <p>Two trusted deliveries finished high with stable speed and execution.</p>
              </div>
              <span className={styles.reactionBadge}>9 pins</span>
            </div>

            <div className={styles.decisionCard}>
              <small>RECOMMENDED ADJUSTMENT</small>
              <h2>Move 2 boards inside.<br />Move the target 1 inside.</h2>
              <div className={styles.decisionMetrics}>
                <span><small>Feet</small><strong>Board 32</strong></span>
                <span><small>Target</small><strong>Board 15</strong></span>
                <span><small>Speed</small><strong>16.7 mph</strong></span>
                <span><small>Confidence</small><strong>84%</strong></span>
              </div>
            </div>

            <div className={styles.reasonPanel}>
              <span><i /> Breakpoint moved earlier</span>
              <span><i /> Speed stayed within 0.2 mph</span>
              <span><i /> Good delivery quality confirmed</span>
            </div>

            <div className={styles.consoleFooter}>
              <span>Current ball: Hammer Black Widow 3.0</span>
              <b>Verify with one controlled shot</b>
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
          <div className={styles.trackingConsole}>
            <div className={styles.trackingHeader}>
              <span><i /> CAMERA ANALYSIS</span>
              <small>Local processing</small>
            </div>
            <div className={styles.captureWindow}>
              <span className={styles.captureReticle} />
              <span className={styles.capturePulse} />
              <div className={styles.captureMessage}><b>Shot detected</b><small>4 key events identified</small></div>
            </div>
            <div className={styles.eventGrid}>
              <span><small>Release</small><strong>0.42 s</strong></span>
              <span><small>Arrow</small><strong>Board 14.2</strong></span>
              <span><small>Breakpoint</small><strong>Board 9.1</strong></span>
              <span><small>Pocket</small><strong>17.6</strong></span>
            </div>
            <div className={styles.trackingConfidence}><span style={{ width: "82%" }} /></div>
          </div>
        </div>
        <div className={styles.trackingCopy}>
          <span>Camera-assisted tracking</span>
          <h2>Bring the delivery into the session.</h2>
          <p>Record or upload a shot and review detected release, arrow crossing, breakpoint, pocket entry, speed, and angle before saving.</p>
          <div className={styles.trackingList}>
            <span><i /> Local browser-side analysis</span>
            <span><i /> Editable detections before saving</span>
            <span><i /> Mobile and tablet capture workflow</span>
          </div>
          <Link href="/register" className={styles.secondaryCta}>Explore tracking</Link>
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
