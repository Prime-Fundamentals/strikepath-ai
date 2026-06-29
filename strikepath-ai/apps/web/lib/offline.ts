import type { ShotInput } from "./types";

const KEY = "strikepath_offline_shots";

export interface QueuedShot {
  id: string;
  sessionId: number;
  payload: ShotInput;
  queuedAt: string;
}

export function getQueuedShots(): QueuedShot[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as QueuedShot[];
  } catch {
    return [];
  }
}

export function queueShot(sessionId: number, payload: ShotInput): QueuedShot {
  const item = { id: crypto.randomUUID(), sessionId, payload, queuedAt: new Date().toISOString() };
  const queue = [...getQueuedShots(), item];
  localStorage.setItem(KEY, JSON.stringify(queue));
  return item;
}

export function removeQueuedShot(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getQueuedShots().filter((item) => item.id !== id)));
}
