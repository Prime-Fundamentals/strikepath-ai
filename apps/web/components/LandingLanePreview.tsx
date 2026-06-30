import styles from "@/app/landing.module.css";

const WIDTH = 260;
const HEIGHT = 438;
const LANE_LEFT = 18;
const LANE_WIDTH = 224;
const TOP = 28;
const BOTTOM = 414;

function xForBoard(board: number) {
  return LANE_LEFT + ((39 - board) / 38) * LANE_WIDTH;
}

function yForDistance(distanceFt: number) {
  return BOTTOM - (distanceFt / 60) * (BOTTOM - TOP);
}

const setup = {
  feet: 30,
  laydown: 27,
  target: 14,
  breakpoint: 9,
  pocket: 17.5,
};

const points = {
  laydown: { x: xForBoard(setup.laydown), y: yForDistance(2) },
  target: { x: xForBoard(setup.target), y: yForDistance(15) },
  breakpoint: { x: xForBoard(setup.breakpoint), y: yForDistance(42) },
  pocket: { x: xForBoard(setup.pocket), y: yForDistance(60) },
};

const currentPath = [
  `M ${points.laydown.x.toFixed(1)} ${points.laydown.y.toFixed(1)}`,
  `C ${(points.laydown.x + 28).toFixed(1)} ${(points.laydown.y - 74).toFixed(1)}, ${(points.target.x - 10).toFixed(1)} ${(points.target.y + 34).toFixed(1)}, ${points.target.x.toFixed(1)} ${points.target.y.toFixed(1)}`,
  `C ${(points.target.x + 18).toFixed(1)} ${(points.target.y - 74).toFixed(1)}, ${(points.breakpoint.x + 6).toFixed(1)} ${(points.breakpoint.y + 48).toFixed(1)}, ${points.breakpoint.x.toFixed(1)} ${points.breakpoint.y.toFixed(1)}`,
  `C ${(points.breakpoint.x - 4).toFixed(1)} ${(points.breakpoint.y - 48).toFixed(1)}, ${(points.pocket.x + 14).toFixed(1)} ${(points.pocket.y + 54).toFixed(1)}, ${points.pocket.x.toFixed(1)} ${points.pocket.y.toFixed(1)}`,
].join(" ");

const suggestedPath = [
  `M ${xForBoard(29).toFixed(1)} ${points.laydown.y.toFixed(1)}`,
  `C ${xForBoard(24).toFixed(1)} ${(points.laydown.y - 76).toFixed(1)}, ${xForBoard(15).toFixed(1)} ${(points.target.y + 34).toFixed(1)}, ${xForBoard(15).toFixed(1)} ${points.target.y.toFixed(1)}`,
  `C ${xForBoard(11).toFixed(1)} ${(points.target.y - 72).toFixed(1)}, ${xForBoard(10).toFixed(1)} ${(points.breakpoint.y + 48).toFixed(1)}, ${xForBoard(10).toFixed(1)} ${points.breakpoint.y.toFixed(1)}`,
  `C ${xForBoard(10).toFixed(1)} ${(points.breakpoint.y - 48).toFixed(1)}, ${xForBoard(17.5).toFixed(1)} ${(points.pocket.y + 54).toFixed(1)}, ${xForBoard(17.5).toFixed(1)} ${points.pocket.y.toFixed(1)}`,
].join(" ");

const pinPositions = [
  { pin: 7, board: 35, row: 0 },
  { pin: 8, board: 25, row: 0 },
  { pin: 9, board: 15, row: 0 },
  { pin: 10, board: 5, row: 0 },
  { pin: 4, board: 30, row: 1 },
  { pin: 5, board: 20, row: 1 },
  { pin: 6, board: 10, row: 1 },
  { pin: 2, board: 25, row: 2 },
  { pin: 3, board: 15, row: 2 },
  { pin: 1, board: 20, row: 3 },
];

export function LandingLanePreview() {
  return (
    <div className={styles.previewLane}>
      <div className={styles.previewLaneHeader}>
        <span>RIGHT-HANDED EXAMPLE</span>
        <small>41 ft house pattern</small>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Professional right-handed strike-line example">
        <defs>
          <linearGradient id="landing-lane-wood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#b57a3f" />
            <stop offset=".22" stopColor="#dfb477" />
            <stop offset=".45" stopColor="#bc8248" />
            <stop offset=".68" stopColor="#e5bc80" />
            <stop offset="1" stopColor="#b97d42" />
          </linearGradient>
          <linearGradient id="landing-oil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9cfaff" stopOpacity=".18" />
            <stop offset="1" stopColor="#00d9ee" stopOpacity="0" />
          </linearGradient>
          <filter id="landing-line-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect x="8" y="18" width="244" height="410" rx="14" fill="#07111a" />
        <rect x={LANE_LEFT - 9} y={TOP} width="7" height={BOTTOM - TOP} rx="4" fill="#111b22" />
        <rect x={LANE_LEFT + LANE_WIDTH + 2} y={TOP} width="7" height={BOTTOM - TOP} rx="4" fill="#111b22" />
        <rect x={LANE_LEFT} y={TOP} width={LANE_WIDTH} height={BOTTOM - TOP} rx="8" fill="url(#landing-lane-wood)" />
        <rect x={LANE_LEFT} y={yForDistance(41)} width={LANE_WIDTH} height={BOTTOM - yForDistance(41)} fill="url(#landing-oil)" />

        {Array.from({ length: 39 }).map((_, index) => {
          const x = LANE_LEFT + (index / 38) * LANE_WIDTH;
          return <line key={index} x1={x} y1={TOP} x2={x} y2={BOTTOM} stroke="#6a431f" strokeOpacity={index % 5 === 0 ? ".28" : ".12"} strokeWidth={index % 5 === 0 ? "1" : ".55"} />;
        })}

        <line x1={LANE_LEFT} y1={yForDistance(15)} x2={LANE_LEFT + LANE_WIDTH} y2={yForDistance(15)} stroke="#31586a" strokeDasharray="5 6" strokeOpacity=".55" />
        {[5, 10, 15, 20, 25, 30, 35].map((board) => {
          const x = xForBoard(board);
          const y = yForDistance(15);
          return <path key={board} d={`M ${x} ${y - 5} L ${x + 5} ${y + 5} L ${x - 5} ${y + 5} Z`} fill="#30383d" />;
        })}

        <path d={suggestedPath} fill="none" stroke="#c29aff" strokeWidth="2.2" strokeDasharray="8 7" opacity=".72" />
        <path d={currentPath} fill="none" stroke="#7df8ff" strokeWidth="10" strokeOpacity=".12" strokeLinecap="round" filter="url(#landing-line-glow)" />
        <path d={currentPath} fill="none" stroke="#7df8ff" strokeWidth="4" strokeLinecap="round" />

        {Object.entries(points).map(([key, point]) => (
          <circle key={key} cx={point.x} cy={point.y} r={key === "breakpoint" ? 6.5 : 5.5} fill={key === "breakpoint" ? "#ffc66a" : key === "pocket" ? "#ffffff" : "#071827"} stroke={key === "breakpoint" ? "#fff4d8" : "#7df8ff"} strokeWidth="2" />
        ))}

        {pinPositions.map(({ pin, board, row }) => (
          <g key={pin} transform={`translate(${xForBoard(board)} ${TOP + 12 + row * 12})`}>
            <circle r="6" fill="#ffffff" stroke="#e84c59" strokeWidth="1.7" />
            <text y="2.1" textAnchor="middle" fill="#13232d" fontSize="5" fontWeight="900">{pin}</text>
          </g>
        ))}
      </svg>
      <div className={styles.previewLaneLegend}>
        <span><i className={styles.currentLegend} />Current line</span>
        <span><i className={styles.suggestedLegend} />Suggested move</span>
      </div>
    </div>
  );
}
