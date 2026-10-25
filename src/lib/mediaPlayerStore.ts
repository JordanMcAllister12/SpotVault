import { useSyncExternalStore } from 'react';

export interface NowPlaying {
  id: string;
  title: string;
  creator: string;
  videoUrl: string;
  contentType: string;
  duration?: number;
  posterUrl?: string;
  isAudio?: boolean;
  youtubeVideoId?: string;
  startAt?: number;
  courseContext?: {
    prevId?: string;
    prevTitle?: string;
    prevUrl?: string;
    nextId?: string;
    nextTitle?: string;
    nextUrl?: string;
  };
  noAutoplay?: boolean;
}

export const INTRO_VIDEO_URL = 'https://huososarkrngtpkpzsws.supabase.co/storage/v1/object/public/Intro-Video/SpotVaultIntro.mp4';

export const INTRO_VIDEO: NowPlaying = {
  id: 'spotvault-intro',
  title: 'SpotVault Introduction',
  creator: 'SpotVault',
  videoUrl: INTRO_VIDEO_URL,
  contentType: 'media',
  noAutoplay: true,
};

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  isLoading: boolean;
  error: string | null;
}

interface MediaPlayerState {
  nowPlaying: NowPlaying | null;
  playback: PlaybackState;
}

const VOLUME_KEY = 'sv-media-volume';
const POSITION_KEY = 'sv-media-positions';

function loadVolume(): number {
  try { return parseFloat(localStorage.getItem(VOLUME_KEY) || '0.7'); } catch { return 0.7; }
}

const DEFAULT_PLAYBACK: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: loadVolume(),
  muted: false,
  playbackRate: 1,
  isLoading: false,
  error: null,
};

let state: MediaPlayerState = {
  nowPlaying: null,
  playback: { ...DEFAULT_PLAYBACK },
};

const listeners = new Set<() => void>();
let playHandler: (() => void) | null = null;

function notify() { listeners.forEach((l) => l()); }

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getSnapshot() { return state; }

export function setPlayHandler(handler: (() => void) | null) { playHandler = handler; }

function loadPositions(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(POSITION_KEY) || '{}'); } catch { return {}; }
}

export function getSavedPosition(id: string): number {
  return loadPositions()[id] ?? 0;
}

function savePosition() {
  if (!state.nowPlaying || state.playback.currentTime < 1) return;
  try {
    const positions = loadPositions();
    positions[state.nowPlaying.id] = state.playback.currentTime;
    localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
  } catch { /* ignore */ }
}

export function clearPosition(id: string) {
  try {
    const positions = loadPositions();
    delete positions[id];
    localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
  } catch { /* ignore */ }
}

export function playInMediaCenter(item: NowPlaying) {
  savePosition();
  const isYoutube = Boolean(item.youtubeVideoId);
  const hasNoSource = !item.videoUrl && !item.youtubeVideoId;
  state = {
    nowPlaying: item,
    playback: {
      ...DEFAULT_PLAYBACK,
      isLoading: false,
      isPlaying: isYoutube,
      error: hasNoSource ? 'No video source available for this item.' : null,
    },
  };
  notify();
  playHandler?.();
}

export function clearNowPlaying() {
  savePosition();
  state = { nowPlaying: null, playback: { ...DEFAULT_PLAYBACK } };
  notify();
}

export function updatePlayback(patch: Partial<PlaybackState>) {
  state = { ...state, playback: { ...state.playback, ...patch } };
  if (patch.volume !== undefined) {
    try { localStorage.setItem(VOLUME_KEY, String(patch.volume)); } catch { /* ignore */ }
  }
  notify();
}

export function useMediaPlayer() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
