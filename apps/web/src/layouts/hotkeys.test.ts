import { afterEach, describe, expect, it } from 'vitest';
import { actionForKey, isTypingTarget, type KeyLike } from './hotkeys';

const ev = (key: string, over: Partial<KeyLike> = {}): KeyLike => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  target: document.body,
  ...over,
});
const el = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.firstElementChild as HTMLElement;
};
afterEach(() => {
  document.body.innerHTML = '';
});

describe('actionForKey', () => {
  it.each([
    ['1', '/'],
    ['2', '/quests'],
    ['3', '/sessions'],
    ['4', '/lab'],
    ['5', '/dungeons'],
    ['h', '/camp'],
    ['H', '/camp'],
  ])('%s goes to %s', (k, to) => {
    expect(actionForKey(ev(k))).toEqual({ kind: 'go', to });
  });

  it('M and m open the menu', () => {
    expect(actionForKey(ev('m'))).toEqual({ kind: 'menu' });
    expect(actionForKey(ev('M'))).toEqual({ kind: 'menu' });
  });

  it.each(['0', '6', 'a', 'Enter', 'Escape', 'ArrowLeft', 'Tab', ' '])('%s does nothing', (k) => {
    expect(actionForKey(ev(k))).toBeNull();
  });

  it('ignores Ctrl, Alt and Meta combinations, repeats, composition and handled events', () => {
    expect(actionForKey(ev('3', { ctrlKey: true }))).toBeNull();
    expect(actionForKey(ev('3', { altKey: true }))).toBeNull();
    expect(actionForKey(ev('3', { metaKey: true }))).toBeNull();
    expect(actionForKey(ev('3', { repeat: true }))).toBeNull();
    expect(actionForKey(ev('3', { isComposing: true }))).toBeNull();
    expect(actionForKey(ev('3', { defaultPrevented: true }))).toBeNull();
  });

  it('ignores keys typed into text fields, selects and editable regions', () => {
    for (const html of [
      '<input type="text" />',
      '<input />',
      '<input type="search" />',
      '<input type="email" />',
      '<textarea></textarea>',
      '<select><option>a</option></select>',
      '<div contenteditable="true"><span id="in">x</span></div>',
      '<div role="textbox" tabindex="0"></div>',
    ]) {
      const target = el(html);
      expect(actionForKey(ev('3', { target })), html).toBeNull();
    }
    expect(actionForKey(ev('3', { target: document.getElementById('in') }))).toBeNull(); // inside contenteditable
  });

  it('still works on buttons, links, checkboxes and non-editable content', () => {
    for (const html of ['<button>x</button>', '<a href="#">x</a>', '<input type="checkbox" />', '<div contenteditable="false">x</div>', '<p>x</p>']) {
      expect(actionForKey(ev('3', { target: el(html) })), html).toEqual({ kind: 'go', to: '/sessions' });
    }
  });
});

describe('isTypingTarget', () => {
  it('is false for a missing or non-element target', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
  });
});
