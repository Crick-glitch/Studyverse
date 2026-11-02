import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

afterEach(() => {
  cleanup();
  // @ts-expect-error jsdom has no matchMedia; remove whatever a test installed
  delete window.matchMedia;
});

describe('useMediaQuery', () => {
  it('is false where matchMedia does not exist', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(false);
  });

  it('follows the query, including later changes', () => {
    let listener: () => void = () => undefined;
    const mq = {
      matches: false,
      addEventListener: vi.fn((_: string, fn: () => void) => {
        listener = fn;
      }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(false);

    mq.matches = true;
    act(() => listener());
    expect(result.current).toBe(true);

    unmount();
    expect(mq.removeEventListener).toHaveBeenCalled();
  });
});
