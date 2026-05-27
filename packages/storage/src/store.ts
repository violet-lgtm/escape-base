import type { GameState } from '@escape/engine';
import { getStqry } from './stqry.js';

/** Our own bucket, kept separate from stqry's default `stqryStorage`. */
const BUCKET = 'escape';
const TIMEOUT_MS = 1500;

const stateKey = (gameId: string) => `state:${gameId}`;
const mirrorKey = (key: string) => `${BUCKET}:${key}`;

/**
 * stqry's storage callbacks have NO built-in timeout (unlike user/device): if
 * the parent never replies, a bare callback hangs forever — which would freeze
 * boot. So every call races a timeout that resolves via the localStorage mirror.
 */
function withTimeout<T>(
  run: (resolve: (value: T) => void) => void,
  fallback: () => T,
  ms = TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: T) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(fallback()), ms);
    run((value) => {
      clearTimeout(timer);
      finish(value);
    });
  });
}

function readMirror(key: string): GameState | null {
  try {
    const raw = localStorage.getItem(mirrorKey(key));
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

function writeMirror(key: string, state: GameState): void {
  try {
    localStorage.setItem(mirrorKey(key), JSON.stringify(state));
  } catch {
    // Storage may be partitioned/full in an embedded webview; mirror is best-effort.
  }
}

export async function loadState(gameId: string): Promise<GameState | null> {
  const key = stateKey(gameId);
  const stqry = getStqry();
  if (!stqry) return readMirror(key);

  return withTimeout<GameState | null>(
    (resolve) => stqry.storage.get(key, (value) => resolve((value as GameState) ?? null), BUCKET),
    () => readMirror(key),
  );
}

/** Wipe saved progress for a game from both the mirror and the stqry store. */
export async function clearState(gameId: string): Promise<void> {
  const key = stateKey(gameId);
  try {
    localStorage.removeItem(mirrorKey(key));
  } catch {
    // best-effort, same as writeMirror
  }

  const stqry = getStqry();
  if (!stqry) return;

  await withTimeout<void>(
    (resolve) => stqry.storage.remove(key, () => resolve(), BUCKET),
    () => undefined,
  );
}

export async function saveState(gameId: string, state: GameState): Promise<void> {
  const key = stateKey(gameId);
  // Synchronous backstop first: always lands, even on an abrupt webview unload.
  writeMirror(key, state);

  const stqry = getStqry();
  if (!stqry) return;

  // `set` merges at the top level, so writing this one key never clobbers siblings.
  await withTimeout<void>(
    (resolve) => stqry.storage.set({ [key]: state }, () => resolve(), BUCKET),
    () => undefined,
  );
}
