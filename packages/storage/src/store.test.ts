import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '@escape/engine';
import type { Stqry } from './stqry.js';
import { loadState, saveState } from './store.js';

const state: GameState = {
  v: 1,
  inventory: ['key'],
  flags: { opened: true },
  visited: ['lobby'],
  lastRoom: 'lobby',
};

/** In-memory stand-in for the stqry bridge, honoring merge + customKey semantics. */
function fakeBridge(): Stqry {
  const buckets: Record<string, Record<string, unknown>> = {};
  const bucket = (k = 'stqryStorage') => (buckets[k] ??= {});
  return {
    storage: {
      get: (key, cb, customKey) => cb(key === null ? bucket(customKey) : bucket(customKey)[key]),
      set: (changeset, cb, customKey) => {
        Object.assign(bucket(customKey), changeset);
        cb?.();
      },
      remove: (key, cb, customKey) => {
        delete bucket(customKey)[key];
        cb?.();
      },
      clear: (cb, customKey) => {
        buckets[customKey ?? 'stqryStorage'] = {};
        cb?.();
      },
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  delete window.stqry;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('store', () => {
  it('round-trips through the localStorage mirror when no bridge is present', async () => {
    await saveState('g', state);
    expect(await loadState('g')).toEqual(state);
  });

  it('returns null for an unknown game', async () => {
    expect(await loadState('missing')).toBeNull();
  });

  it('round-trips through the stqry bridge when present', async () => {
    window.stqry = fakeBridge();
    await saveState('g', state);
    expect(await loadState('g')).toEqual(state);
  });

  it('falls back to the mirror when stqry storage never responds', async () => {
    await saveState('g', state); // seed the mirror with no bridge
    window.stqry = {
      storage: { get: () => {}, set: (_c, cb) => cb?.(), remove: () => {}, clear: () => {} },
    };

    vi.useFakeTimers();
    const pending = loadState('g');
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toEqual(state);
  });
});
