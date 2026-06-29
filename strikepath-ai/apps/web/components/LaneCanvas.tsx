"use client";

import type { LaneState, Shot } from "@/lib/types";

function xForBoard(board: number) {
  return 25 + ((39 - board) / 38) * 370;
}
function yForDistance(distance: number) {
  return 710 - (distance / 60) * 660;
}

export function LaneCanvas({ shots, laneState }: { shots: Shot[]; laneState: LaneState | null }) {
  const latest = shots[shots.length - 1];
  const points = latest ? [
    `${xForBoard(latest.laydown_board)},${yForDistance(0)}`,
    `${xForBoard(latest.target_board)},${yForDistance(15)}`,
    `${xForBoard(latest.breakpoint_board)},${yForDistance(44)}`,
    `${xForBoard(latest.pocket_board)},${yForDistance(60)}`,
  ] : [];
  const path = points.length ? `M ${points[0]} C ${points[1]} ${points[2]} ${points[3]}` : "";

  return (
    <div className="lane-wrap">
      <svg className="lane-svg" viewBox="0 0 420 760" role="img" aria-label="Bowling lane path visualization">
        <defs>
          <linearGradient id="laneWood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#b9844c"/><stop offset=".5" stopColor="#e0b879"/><stop offset="1" stopColor="#b9844c"/>
          </linearGradient>
          <linearGradient id="oilWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#00f5ff" stopOpacity=".18"/><stop offset=".75" stopColor="#00a4d8" stopOpacity=".08"/><stop offset="1" stopColor="#00a4d8" stopOpacity="0"/>
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect x="17" y="30" width="386" height="700" rx="13" fill="#06101e" stroke="#193852" strokeWidth="2"/>
        <rect x="25" y="48" width="370" height="665" rx="6" fill="url(#laneWood)"/>
        <rect x="25" y="250" width="370" height="463" fill="url(#oilWash)"/>
        {Array.from({ length: 40 }).map((_, index) => (
          <line key={index} x1={25 + (370 / 39) * index} y1="48" x2={25 + (370 / 39) * index} y2="713" stroke="#50371f" strokeOpacity={index % 5 === 0 ? ".35" : ".15"} strokeWidth={index % 5 === 0 ? "1" : ".6"}/>
        ))}
        <line x1="25" y1={yForDistance(15)} x2="395" y2={yForDistance(15)} stroke="#0f5b67" strokeOpacity=".4"/>
        {[5,10,15,20,25,30,35].map((board) => <path key={board} d={`M ${xForBoard(board)} ${yForDistance(15)-5} l 5 10 h -10 z`} fill="#374452" opacity=".7"/>)}
        <line x1="25" y1={yForDistance(60)} x2="395" y2={yForDistance(60)} stroke="#fff" strokeOpacity=".55" strokeWidth="2"/>
        {Array.from({ length: 10 }).map((_, i) => {
          const row = i < 4 ? 0 : i < 7 ? 1 : i < 9 ? 2 : 3;
          const pos = i < 4 ? i : i < 7 ? i - 4 : i < 9 ? i - 7 : 0;
          const counts = [4,3,2,1];
          return <circle key={i} cx={210 + (pos-(counts[row]-1)/2)*27} cy={44+row*18} r="5" fill="#fff" stroke="#c3d4df"/>;
        })}
        {laneState?.paths.slice(-6, -1).map((item, idx) => {
          const d = item.samples.map((s, i) => `${i === 0 ? "M" : "L"} ${xForBoard(s.board)} ${yForDistance(s.distance_ft)}`).join(" ");
          return <path key={item.shot_id} d={d} fill="none" stroke="#2d7d9b" strokeOpacity={0.16 + idx * 0.06} strokeWidth="2"/>;
        })}
        {path && <path d={path} fill="none" stroke="#00f5ff" strokeWidth="5" strokeLinecap="round" filter="url(#glow)"/>}
        {latest && <>
          <circle cx={xForBoard(latest.laydown_board)} cy={yForDistance(0)} r="8" fill="#071825" stroke="#fff" strokeWidth="3"/>
          <circle cx={xForBoard(latest.target_board)} cy={yForDistance(15)} r="7" fill="#00f5ff" stroke="#fff" strokeWidth="2"/>
          <circle cx={xForBoard(latest.breakpoint_board)} cy={yForDistance(44)} r="7" fill="#ffc663" stroke="#fff" strokeWidth="2"/>
          <circle cx={xForBoard(latest.pocket_board)} cy={yForDistance(60)} r="8" fill="#fff" stroke="#00f5ff" strokeWidth="3"/>
        </>}
        <text x="210" y="747" textAnchor="middle" fill="#607c90" fontSize="11">BOARD VIEW • RIGHT-TO-LEFT 1–39</text>
      </svg>
      <div className="lane-legend"><span><i className="cyan"/>Target</span><span><i className="gold"/>Breakpoint</span><span><i className="white"/>Pocket</span></div>
    </div>
  );
}
