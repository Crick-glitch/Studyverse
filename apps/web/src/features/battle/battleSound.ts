import type { BattleEventName } from './useBattleAnimations';

/**
 * Battle sounds: tiny WebAudio tones (as in the old game), keyed by the same event names the animations use, so audio and
 * visuals stay in step. Silent where audio is unavailable. Called only when the player's Sound toggle is on.
 */
type SoundEvent = 'correct' | 'wrong' | 'hit' | 'victory' | 'defeat';
const TONES: Record<SoundEvent, { hz: number; ms: number; gain: number }> = {
  correct: { hz: 800, ms: 110, gain: 0.12 },
  hit: { hz: 520, ms: 90, gain: 0.1 },
  wrong: { hz: 220, ms: 180, gain: 0.12 },
  victory: { hz: 1200, ms: 320, gain: 0.12 },
  defeat: { hz: 150, ms: 400, gain: 0.12 },
};

let ctx: AudioContext | null = null;

export function playTone(event: SoundEvent): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    const t = TONES[event];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = t.hz;
    gain.gain.setValueAtTime(t.gain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + t.ms / 1000);
  } catch {
    /* no audio: the battle works the same */
  }
}

/** The same event names the animations emit: the sound plays when the move LANDS on screen, not when the server replied. */
const SOUND_FOR: Record<BattleEventName, SoundEvent> = { heroAttack: 'correct', enemyAttack: 'wrong', hit: 'hit', victory: 'victory', defeat: 'defeat' };
export const playBattleEvent = (name: BattleEventName): void => playTone(SOUND_FOR[name]);
