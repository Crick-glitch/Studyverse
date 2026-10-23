import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

afterEach(cleanup);

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button type="button">opener</button>
      {open && (
        <Dialog title="Sure?" onClose={onClose}>
          <button type="button">first</button>
          <button type="button">last</button>
        </Dialog>
      )}
    </>
  );
}

describe('Dialog', () => {
  it('is labelled by its title and moves focus inside', () => {
    render(<Harness open onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Sure?' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }));
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab: from the last control it wraps to the first, and back with Shift+Tab', () => {
    render(<Harness open onClose={vi.fn()} />);
    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('gives focus back to the opener when it closes', () => {
    const { rerender } = render(<Harness open={false} onClose={vi.fn()} />);
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    rerender(<Harness open onClose={vi.fn()} />);
    expect(document.activeElement).not.toBe(opener);
    rerender(<Harness open={false} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(opener);
  });
});
