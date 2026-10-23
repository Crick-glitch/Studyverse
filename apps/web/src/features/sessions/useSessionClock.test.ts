import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from './useSessionClock';

let now = 1000;
beforeEach(() => {
  now = 1000;
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const session = (status: 'running' | 'paused', remainingSec: number, serverNow: string) => ({
  status,
  remainingSec,
  serverNow,
});

describe('useCountdown', () => {
  it('counts down from the server remaining seconds, not from the browser clock', () => {
    const { result } = renderHook(() => useCountdown(session('running', 60, 't1')));
    expect(result.current).toBe(60);
    now += 5000;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(55);
  });

  it('does not move while paused', () => {
    const { result } = renderHook(() => useCountdown(session('paused', 42, 't1')));
    now += 30_000;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(42);
  });

  it('re-syncs when the server sends a new response', () => {
    const { result, rerender } = renderHook(({ s }) => useCountdown(s), {
      initialProps: { s: session('running', 60, 't1') },
    });
    now += 10_000;
    rerender({ s: session('running', 47, 't2') });
    expect(result.current).toBe(47);
  });

  it('stops at zero', () => {
    const { result } = renderHook(() => useCountdown(session('running', 3, 't1')));
    now += 20_000;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(0);
  });
});
