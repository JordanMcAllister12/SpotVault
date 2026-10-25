import { useSyncExternalStore } from 'react';

export type SweatStatus = 'live' | 'ended';
export type SweatCategory = 'friends' | 'notables';

export interface Sweat {
  id: string;
  authorId: string;
  authorName: string;
  site: string;
  tournament: string;
  table: string;
  position: string;
  stack?: string;
  comment?: string;
  status: SweatStatus;
  category: SweatCategory;
  createdAt: number;
  updatedAt: number;
}

interface SweatState {
  sweats: Sweat[];
  currentUserId: string;
  currentUserName: string;
}

let state: SweatState = {
  sweats: [],
  currentUserId: '',
  currentUserName: '',
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return state;
}

function setState(updater: (prev: SweatState) => SweatState) {
  state = updater(state);
  notify();
}

export function initSweatUser(userId: string, userName: string) {
  setState((prev) => ({
    ...prev,
    currentUserId: userId,
    currentUserName: userName,
    sweats: prev.sweats,
  }));
}

export function postSweat(
  site: string,
  tournament: string,
  table: string,
  position: string,
  stack: string,
  comment: string,
  category: SweatCategory = 'friends',
) {
  const now = Date.now();
  const sweat: Sweat = {
    id: `sweat-${now}-${Math.random().toString(36).slice(2, 7)}`,
    authorId: state.currentUserId,
    authorName: state.currentUserName,
    site,
    tournament,
    table,
    position,
    stack: stack || undefined,
    comment: comment || undefined,
    status: 'live',
    category,
    createdAt: now,
    updatedAt: now,
  };
  setState((prev) => ({ ...prev, sweats: [sweat, ...prev.sweats] }));
}

export function updateSweat(sweatId: string, position: string, comment: string) {
  setState((prev) => ({
    ...prev,
    sweats: prev.sweats.map((s) =>
      s.id === sweatId
        ? { ...s, position, comment: comment || s.comment, updatedAt: Date.now() }
        : s,
    ),
  }));
}

export function endSweat(sweatId: string) {
  setState((prev) => ({
    ...prev,
    sweats: prev.sweats.map((s) =>
      s.id === sweatId ? { ...s, status: 'ended' as const, updatedAt: Date.now() } : s,
    ),
  }));
}

export function deleteSweat(sweatId: string) {
  setState((prev) => ({
    ...prev,
    sweats: prev.sweats.filter((s) => s.id !== sweatId),
  }));
}

function expireStale() {
  const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
  setState((prev) => ({
    ...prev,
    sweats: prev.sweats.map((s) =>
      s.status === 'live' && s.updatedAt < fourHoursAgo
        ? { ...s, status: 'ended' as const }
        : s,
    ),
  }));
}

export function getLiveSweats(category?: SweatCategory): Sweat[] {
  expireStale();
  return state.sweats.filter(
    (s) => s.status === 'live' && (!category || s.category === category),
  );
}

export function useSweatStore(): SweatState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...snapshot,
    sweats: Array.isArray(snapshot.sweats) ? snapshot.sweats : [],
  };
}
