// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderHook } from '@testing-library/react';

// Polyfill ResizeObserver for jsdom
beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
});

// Test that useTableScale never gates rendering on container measurement
describe('useTableScale — mobile replayer loading fix', () => {
  it('ready is always true (never gates render on measurement)', async () => {
    const { useTableScale } = await import('../useTableScale');
    const { result } = renderHook(() => useTableScale());
    expect(result.current.ready).toBe(true);
  });

  it('ready is true even when container ref is null', async () => {
    const { useTableScale } = await import('../useTableScale');
    const { result } = renderHook(() => useTableScale(true));
    expect(result.current.ready).toBe(true);
  });

  it('scale falls back to 1 when container width is 0', async () => {
    const { useTableScale } = await import('../useTableScale');
    const { result } = renderHook(() => useTableScale(true));
    // Before any measurement, scale should be 1 (not NaN, not Infinity)
    expect(result.current.scale).toBe(1);
    expect(Number.isFinite(result.current.scale)).toBe(true);
  });

  it('scaledHeight is 0 on desktop (not active)', async () => {
    const { useTableScale } = await import('../useTableScale');
    const { result } = renderHook(() => useTableScale(false));
    expect(result.current.isMobile).toBe(false);
    expect(result.current.scaledHeight).toBe(0);
  });
});

describe('HHReplayer — no infinite spinner', () => {
  it('renders no-hand state instead of spinner when no hand is provided', async () => {
    const { HHReplayer } = await import('../HHReplayer');
    const { render } = await import('@testing-library/react');

    const { container } = render(
      <HHReplayer variant="embedded" />
    );

    // Should NOT have a spinner
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeNull();

    // Should render the poker table (not a "No hand selected" text)
    expect(container.textContent).not.toContain('No hand selected');
  });

  it('renders a hand without infinite loading', async () => {
    const { HHReplayer } = await import('../HHReplayer');
    const { render } = await import('@testing-library/react');
    const { EMPTY_NORMALIZED_HAND } = await import('../types');

    const hand: typeof EMPTY_NORMALIZED_HAND = {
      ...EMPTY_NORMALIZED_HAND,
      handId: 'test-hand-1',
      players: [
        { name: 'Hero', seat: 1, stack: 1000, isHero: true, position: 'BTN' },
        { name: 'Villain', seat: 2, stack: 1000, isHero: false, position: 'BB' },
      ],
      actions: [],
      buttonSeat: 1,
      winners: [],
    };

    const { container } = render(
      <HHReplayer hand={hand} variant="embedded" />
    );

    // Should NOT have a spinner
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeNull();
  });
});
