import { useState, useCallback } from 'react';

export interface DemoUserState {
  credits: number;
  level: number;
  tier: 'GOLD';
  xp: number;
  xpToNext: number;
  handle: string;
  name: string;
}

const INITIAL: DemoUserState = {
  credits: 0,
  level: 0,
  tier: 'GOLD',
  xp: 0,
  xpToNext: 0,
  handle: '',
  name: '',
};

let state: DemoUserState = { ...INITIAL };
const listeners = new Set<() => void>();

export function getDemoUserState(): DemoUserState {
  return state;
}

export function setDemoUserState(updater: (prev: DemoUserState) => DemoUserState) {
  state = updater(state);
  listeners.forEach((l) => l());
}

export function spendCredits(amount: number): boolean {
  if (state.credits < amount) return false;
  setDemoUserState((prev) => ({ ...prev, credits: prev.credits - amount }));
  return true;
}

export function addCredits(amount: number) {
  setDemoUserState((prev) => ({ ...prev, credits: prev.credits + amount }));
}

export function useDemoUserState(): DemoUserState {
  const [, forceRender] = useState(0);
  const listener = useCallback(() => forceRender((n) => n + 1), []);
  if (typeof window !== 'undefined') {
    listeners.add(listener);
  }
  return state;
}
