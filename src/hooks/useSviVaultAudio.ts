import { useCallback, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// SVI Vault Cinematic Sound Effects
// Web Audio synthesis — no external files, starts on user gesture.
// Respects browser autoplay restrictions (created on click, not autoplay).
// ─────────────────────────────────────────────────────────────

type SoundName = 'activation' | 'charging' | 'fullCharge' | 'explosion' | 'chime';

export function useSviVaultAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const [muted, setMutedState] = useState(false);

  // Respect saved mute preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('svi-vault-muted');
      if (saved === 'true') { mutedRef.current = true; setMutedState(true); }
    } catch { /* ignore */ }
  }, []);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const setMuted = useCallback((m: boolean) => {
    mutedRef.current = m;
    setMutedState(m);
    try { localStorage.setItem('svi-vault-muted', String(m)); } catch { /* ignore */ }
  }, []);

  // ── Tone helper ──
  const tone = useCallback((ctx: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    env.gain.setValueAtTime(0, ctx.currentTime + start);
    env.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.connect(env).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  }, []);

  // ── Noise burst helper (for explosion) ──
  const noiseBurst = useCallback((ctx: AudioContext, start: number, dur: number, gain: number, filterFreq: number) => {
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime + start);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + start + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, ctx.currentTime + start);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    src.connect(filter).connect(env).connect(ctx.destination);
    src.start(ctx.currentTime + start);
    src.stop(ctx.currentTime + start + dur + 0.05);
  }, []);

  // ── Sweep helper (rising/falling pitch) ──
  const sweep = useCallback((ctx: AudioContext, fromFreq: number, toFreq: number, start: number, dur: number, type: OscillatorType, gain: number) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, ctx.currentTime + start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(toFreq, 1), ctx.currentTime + start + dur);
    env.gain.setValueAtTime(0, ctx.currentTime + start);
    env.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.connect(env).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  }, []);

  const play = useCallback((name: SoundName) => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;

    switch (name) {
      case 'activation': {
        // Mechanical click + low hum
        tone(ctx, 180, 0, 0.08, 'square', 0.15);
        tone(ctx, 60, 0.02, 0.3, 'sine', 0.1);
        break;
      }
      case 'charging': {
        // Rising charging whine (0.5–2.0s sustained)
        sweep(ctx, 120, 900, 0, 1.5, 'sawtooth', 0.08);
        tone(ctx, 300, 0, 1.5, 'sine', 0.04);
        break;
      }
      case 'fullCharge': {
        // Full-charge surge — bright crackle
        sweep(ctx, 900, 2000, 0, 0.15, 'sawtooth', 0.12);
        noiseBurst(ctx, 0.1, 0.2, 0.06, 3000);
        tone(ctx, 1200, 0.05, 0.15, 'square', 0.08);
        break;
      }
      case 'explosion': {
        // Bass hit + noise crash
        tone(ctx, 80, 0, 0.6, 'sine', 0.25);
        sweep(ctx, 200, 40, 0, 0.5, 'sine', 0.15);
        noiseBurst(ctx, 0, 0.4, 0.2, 2000);
        tone(ctx, 150, 0.05, 0.3, 'triangle', 0.1);
        break;
      }
      case 'chime': {
        // Triumphant crystalline chime — 3 ascending notes
        tone(ctx, 523.25, 0, 0.4, 'sine', 0.12);   // C5
        tone(ctx, 659.25, 0.12, 0.4, 'sine', 0.12); // E5
        tone(ctx, 783.99, 0.24, 0.6, 'sine', 0.15); // G5
        tone(ctx, 1046.5, 0.36, 0.8, 'sine', 0.1);  // C6
        break;
      }
    }
  }, [getCtx, tone, noiseBurst, sweep]);

  return { play, muted, setMuted };
}
