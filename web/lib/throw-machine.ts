// web/lib/throw-machine.ts
import type { ThrowResult } from "./api.js";

export type ThrowPhase =
  | "idle"
  | "shaking"
  | "landing"
  | "recorded"
  | "paused"
  | "complete";

export interface ThrowMachineState {
  phase: ThrowPhase;
  throws: readonly ThrowResult[];
  nextIndex: number;
  message?: string;
}

export type ThrowAction =
  | { type: "press" }
  | { type: "release" }
  | { type: "resolved"; result: ThrowResult }
  | { type: "ready" }
  | { type: "pause"; message: string }
  | { type: "resume" };

export function initialThrowState(throws: readonly ThrowResult[]): ThrowMachineState {
  const ordered = [...throws].sort((left, right) => left.index - right.index);
  return {
    phase: ordered.length >= 6 ? "complete" : "idle",
    throws: ordered,
    nextIndex: Math.min(ordered.length + 1, 6),
  };
}

export function reduceThrow(
  state: ThrowMachineState,
  action: ThrowAction,
): ThrowMachineState {
  if (action.type === "press" && state.phase === "idle") {
    const next = { ...state };
    delete next.message;
    return { ...next, phase: "shaking" };
  }
  if (action.type === "release" && state.phase === "shaking") {
    return { ...state, phase: "landing" };
  }
  if (action.type === "resolved" && state.phase === "landing") {
    if (action.result.index !== state.nextIndex) {
      return state;
    }
    const throws = [...state.throws, action.result];
    return {
      phase: throws.length === 6 ? "complete" : "recorded",
      throws,
      nextIndex: Math.min(throws.length + 1, 6),
    };
  }
  if (action.type === "ready" && state.phase === "recorded") {
    return { ...state, phase: "idle" };
  }
  if (action.type === "pause" && state.phase === "landing") {
    return { ...state, phase: "paused", message: action.message };
  }
  if (action.type === "resume" && state.phase === "paused") {
    const next = { ...state };
    delete next.message;
    return { ...next, phase: "idle" };
  }
  return state;
}
