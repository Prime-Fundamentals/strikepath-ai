"use client";

import { useId } from "react";
import type { Handedness, Shot, ShotInput } from "@/lib/types";
import type { AISuggestedSetup } from "@/lib/aiSetup";
import { formatBoard, toDisplayBoard } from "@/lib/boards";
import { parseLeave } from "./PinLeaveSelector";
import styles from "./LaneCanvas.module.css";

const WIDTH=760, HEIGHT=500, LEFT=90, DECK_WIDTH=580, TOP=62, DECK_HEIGHT=350;
const pinBoards:Record<number,number>={1:20,2:25,3:15,4:30,5:20,6:10,7:35,8:25,9:15,10:5};
const pinRows:Record<number,number>={7:0,8:0,9:0,10:0,4:1,5:1,6:1,2:2,3:2,1:3};
function xForBoard(board:number){return LEFT+((39-board)/38)*DECK_WIDTH;}
function yForPin(pin:number){return TOP+70+pinRows[pin]*66;}
function leadPin(pins:number[]){return [1,2,3,4,5,6,7,8,9,10].find((pin)=>pins.includes(pin))??null;}
function impactLabel(pins:number[]){if(!pins.length)return"Strike result";if(pins.length===1)return`Direct line to pin ${pins[0]}`;const lead=leadPin(pins);return lead?`Enter through pin ${lead} and continue through the cluster`:"Review the leave";}

export function PinDeckZoom({shot,handedness,aiSetup}:{shot:ShotInput|Shot|null;handedness:Handedness;aiSetup?:AISuggestedSetup|null}){
  const id=useId().replace(/:/g,"_");
  const standing=shot?parseLeave(shot.leave_code,shot.pinfall):[1,2,3,4,5,6,7,8,9,10];
  const lead=leadPin(standing);
  const entryBoard=aiSetup?.pocketBoard??(lead?pinBoards[lead]:shot?.pocket_board??20);
  const entryX=xForBoard(entryBoard), impactY=lead?yForPin(lead):yForPin(1);
  return <div className={styles.pinDeckCard}>
    <div className={styles.pinDeckHeading}><div><small>PIN-DECK VIEW</small><h3>Impact zone and spare entry</h3></div><span>{impactLabel(standing)}</span></div>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.pinDeckSvg} role="img" aria-label="Enlarged pin deck">
      <defs>
        <linearGradient id={`${id}_wood`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c78d50"/><stop offset=".5" stopColor="#edc98f"/><stop offset="1" stopColor="#c58a4e"/></linearGradient>
        <radialGradient id={`${id}_impact`}><stop offset="0" stopColor="#fff" stopOpacity=".9"/><stop offset=".3" stopColor="#60f4ff" stopOpacity=".5"/><stop offset="1" stopColor="#60f4ff" stopOpacity="0"/></radialGradient>
      </defs>
      <rect x="20" y="18" width="720" height="452" rx="24" fill="#050d17" stroke="#1c3a52" strokeWidth="2"/>
      <rect x={LEFT-25} y={TOP} width="18" height={DECK_HEIGHT} rx="9" fill="#1b2730"/>
      <rect x={LEFT+DECK_WIDTH+7} y={TOP} width="18" height={DECK_HEIGHT} rx="9" fill="#1b2730"/>
      <rect x={LEFT} y={TOP} width={DECK_WIDTH} height={DECK_HEIGHT} rx="9" fill={`url(#${id}_wood)`}/>
      {Array.from({length:39}).map((_,i)=>{const x=LEFT+(DECK_WIDTH/38)*i;return <line key={i} x1={x} y1={TOP} x2={x} y2={TOP+DECK_HEIGHT} stroke="#70431f" strokeOpacity={i%5===0?.28:.12} strokeWidth={i%5===0?1:.5}/>;})}
      {[39,35,30,25,20,15,10,5,1].map((board)=><text key={board} x={xForBoard(board)} y={TOP+DECK_HEIGHT+28} textAnchor="middle" fill="#e9f8ff" fontSize="14" fontWeight="900">{formatBoard(toDisplayBoard(board,handedness))}</text>)}
      <path d={`M ${entryX} ${TOP+DECK_HEIGHT-12} Q ${entryX} ${impactY+50} ${xForBoard(lead?pinBoards[lead]:20)} ${impactY}`} stroke="#c999ff" strokeWidth="4" strokeDasharray="10 8" fill="none"/>
      <circle cx={xForBoard(lead?pinBoards[lead]:20)} cy={impactY} r="45" fill={`url(#${id}_impact)`}/>
      {Object.keys(pinBoards).map((key)=>{const pin=Number(key),x=xForBoard(pinBoards[pin]),y=yForPin(pin),isStanding=standing.includes(pin);return <g key={pin} transform={`translate(${x} ${y})`} opacity={isStanding?1:.16}>
        <circle cx="2" cy="3" r="27" fill="rgba(0,0,0,.22)"/>
        <circle r="24" fill={isStanding?"#fff":"#7e8d98"} stroke={isStanding?"#d7e9f2":"#5d6c76"} strokeWidth="2"/>
        <circle r="14" fill="none" stroke={isStanding?"#e84755":"#65737d"} strokeWidth="5"/>
        <circle r="8" fill={isStanding?"#fff":"#84919b"}/><text y="4" textAnchor="middle" fill="#07141d" fontSize="10" fontWeight="900">{pin}</text>
      </g>;})}
      <rect x="250" y="27" width="260" height="30" rx="15" fill="rgba(5,18,29,.92)" stroke="#6af4ff"/>
      <text x="380" y="47" textAnchor="middle" fill="#effcff" fontSize="13" fontWeight="900">Entry board {formatBoard(toDisplayBoard(entryBoard,handedness))}</text>
    </svg>
    <div className={styles.summaryRow}><span><small>Standing pins</small><b>{standing.length?standing.join("-"):"None"}</b></span><span><small>Lead pin</small><b>{lead??"—"}</b></span><span><small>Suggested entry</small><b>Board {formatBoard(toDisplayBoard(entryBoard,handedness))}</b></span></div>
  </div>;
}
