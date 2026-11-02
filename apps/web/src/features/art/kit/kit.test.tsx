import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InventorySlot, PixelBar, PixelButton, PixelIcon, PixelPanel, SkillNode, StreakFlame, XpCrest, filledSegments, flameLevelForStreak } from '.';
import { ItemIcon } from '../components';

afterEach(cleanup);

describe('PixelBar', () => {
  it('is a labelled progressbar with the real numbers', () => {
    render(<PixelBar label="Hero HP" tone="hp" value={64} max={100} />);
    const bar = screen.getByRole('progressbar', { name: 'Hero HP' });
    expect(bar.getAttribute('aria-valuenow')).toBe('64');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuetext')).toBe('64 of 100');
    expect(bar.textContent).toContain('64/100');
  });

  it('clamps out-of-range values', () => {
    render(<PixelBar label="over" value={150} max={100} />);
    render(<PixelBar label="under" value={-5} max={100} />);
    expect(screen.getByRole('progressbar', { name: 'over' }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByRole('progressbar', { name: 'under' }).getAttribute('aria-valuenow')).toBe('0');
  });

  it('fills whole segments so every edge lands on a pixel', () => {
    expect(filledSegments(0, 100, 20)).toBe(0);
    expect(filledSegments(1, 100, 20)).toBe(1);
    expect(filledSegments(50, 100, 20)).toBe(10);
    expect(filledSegments(100, 100, 20)).toBe(20);
    expect(filledSegments(5, 0, 20)).toBe(0);
    const { container } = render(<PixelBar label="x" value={50} max={100} segments={20} />);
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-on]')).toHaveLength(20);
  });
});

describe('PixelButton', () => {
  it('is a real button that never submits a form by accident', () => {
    render(<PixelButton variant="primary">Go</PixelButton>);
    const b = screen.getByRole('button', { name: 'Go' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.getAttribute('data-variant')).toBe('primary');
  });

  it('does nothing while disabled and fires when enabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<PixelButton disabled onClick={onClick}>Go</PixelButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).not.toHaveBeenCalled();
    rerender(<PixelButton onClick={onClick}>Go</PixelButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes a toggled look through aria-pressed', () => {
    render(<PixelButton pressed aria-pressed="true">On</PixelButton>);
    expect(screen.getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('PixelPanel', () => {
  it('renders its title at the requested heading level', () => {
    render(<PixelPanel title="Camp" titleLevel={3}>body</PixelPanel>);
    expect(screen.getByRole('heading', { level: 3, name: 'Camp' })).toBeTruthy();
  });
  it('has no heading when there is no title', () => {
    render(<PixelPanel>body</PixelPanel>);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('InventorySlot', () => {
  it('is a toggle button when it can be chosen', () => {
    const onClick = vi.fn();
    render(<InventorySlot label="Quillblade, rare weapon" rarity="rare" selected onClick={onClick}><ItemIcon id="weapon.quillblade" /></InventorySlot>);
    const b = screen.getByRole('button', { name: 'Quillblade, rare weapon' });
    expect(b.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalled();
  });
  it('is a plain labelled group for display only', () => {
    render(<InventorySlot label="Empty weapon slot" empty />);
    expect(screen.getByRole('group', { name: 'Empty weapon slot' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('SkillNode', () => {
  it('only an available node can be activated', () => {
    const onClick = vi.fn();
    const { rerender } = render(<SkillNode state="locked" label="Executioner" cost={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    rerender(<SkillNode state="unlocked" label="Executioner" cost={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    rerender(<SkillNode state="available" label="Executioner" cost={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('says its state, cost and effect to assistive tech, and stays focusable when locked', () => {
    render(<SkillNode state="locked" label="Berserk" cost={3} description="+30% damage while HP < 50%" />);
    const b = screen.getByRole('button');
    expect(b.getAttribute('aria-label')).toBe('Berserk, locked, costs 3 skill points. +30% damage while HP < 50%');
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect((b as HTMLButtonElement).disabled).toBe(false);
  });

  it('uses the singular for one point', () => {
    render(<SkillNode state="available" label="Power Strike" cost={1} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('costs 1 skill point');
    expect(screen.getByRole('button').getAttribute('aria-label')).not.toContain('points');
  });
});

describe('StreakFlame and XpCrest', () => {
  it.each([[0, 0], [1, 1], [2, 1], [3, 2], [6, 2], [7, 3], [13, 3], [14, 4], [90, 4], [-2, 0]])('a %i-day streak is flame level %i', (days, level) => {
    expect(flameLevelForStreak(days)).toBe(level);
  });

  it('names the streak and level', () => {
    render(<StreakFlame streak={8} />);
    expect(screen.getByRole('img', { name: '8-day streak, flame level 3' })).toBeTruthy();
  });

  it('shows the player level on the crest', () => {
    render(<XpCrest level={7} />);
    expect(screen.getByRole('img', { name: 'Level 7' }).textContent).toBe('7');
  });
});

describe('PixelIcon', () => {
  it('is decorative by default and labelled on request', () => {
    const a = render(<PixelIcon name="quests" />);
    expect(a.container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    a.unmount();
    render(<PixelIcon name="quests" label="Quest board" />);
    expect(screen.getByRole('img', { name: 'Quest board' })).toBeTruthy();
  });
});
