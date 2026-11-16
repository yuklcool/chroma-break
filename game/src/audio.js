// Synthesized sound: every effect is a few WebAudio oscillators, no sound files.
// The context is created lazily on the first user gesture, and every call is
// guarded, so the game plays on silently when audio is unavailable.

import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio() {
  let context = null;
  let muted = readMuted();

  function ensureContext() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  /** One short tone: frequency slides from `from` to `to` while fading out. */
  function tone(from, to, seconds, type, volume, delay) {
    if (muted) return;
    const ctx = ensureContext();
    if (ctx === null) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const start = ctx.currentTime + (delay || 0);
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(30, from), start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, to), start + seconds);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + seconds + 0.02);
    } catch {
      // A failed tone never stops the game.
    }
  }

  return {
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage can be off: the choice then lasts this visit only.
      }
      return muted;
    },
    /** Called on the first gesture so later sounds are allowed to play. */
    unlock() {
      ensureContext();
    },
    launch() {
      tone(320, 640, 0.12, 'sine', 0.16);
    },
    /** The soft blip when the player switches the spark's colour mid-flight. */
    cycle() {
      tone(660, 880, 0.06, 'sine', 0.12);
    },
    paddleBounce() {
      tone(220, 180, 0.07, 'triangle', 0.18);
    },
    /** The break note climbs a semitone with the combo streak. */
    prismBreak(streak) {
      const base = 440 * 2 ** (Math.min(streak, 24) / 12);
      tone(base, base * 1.5, 0.14, 'square', 0.12);
      tone(base * 2, base * 2.5, 0.1, 'sine', 0.08, 0.02);
    },
    mismatch() {
      tone(140, 90, 0.12, 'sawtooth', 0.14);
    },
    steelBounce() {
      tone(180, 160, 0.05, 'square', 0.08);
    },
    powerup() {
      tone(523, 523, 0.09, 'sine', 0.16);
      tone(659, 659, 0.09, 'sine', 0.16, 0.08);
      tone(784, 784, 0.16, 'sine', 0.16, 0.16);
    },
    levelClear() {
      tone(523, 523, 0.12, 'triangle', 0.18);
      tone(659, 659, 0.12, 'triangle', 0.18, 0.1);
      tone(784, 784, 0.12, 'triangle', 0.18, 0.2);
      tone(1047, 1047, 0.28, 'triangle', 0.2, 0.3);
    },
    lifeLost() {
      tone(330, 110, 0.4, 'sawtooth', 0.14);
    },
    gameOver() {
      tone(392, 392, 0.18, 'triangle', 0.16);
      tone(311, 311, 0.18, 'triangle', 0.16, 0.16);
      tone(233, 180, 0.4, 'triangle', 0.16, 0.32);
    },
    win() {
      tone(523, 523, 0.14, 'triangle', 0.18);
      tone(659, 659, 0.14, 'triangle', 0.18, 0.12);
      tone(784, 784, 0.14, 'triangle', 0.18, 0.24);
      tone(1047, 1319, 0.4, 'triangle', 0.2, 0.36);
    },
  };
}
