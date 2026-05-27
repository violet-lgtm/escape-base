/**
 * Typed surface for the STQRY bridge (`window.stqry`, injected by stqry-bridge.js).
 *
 * The bridge is callback-based and runs in one of three modes: NoRuntime
 * (standalone browser → localStorage), IFrame (postMessage to parent), and
 * ReactNative (the real stqry app). Storage routes to the *parent/native app*,
 * which is the only store that survives across separate room page loads.
 */

export type StqryRuntime = 'NoRuntime' | 'IFrame' | 'ReactNative';

export interface StqryStorage {
  get(key: string | null, cb: (value: unknown) => void, customKey?: string): void;
  set(changeset: Record<string, unknown>, cb?: () => void, customKey?: string): void;
  remove(key: string, cb?: () => void, customKey?: string): void;
  clear(cb?: () => void, customKey?: string): void;
}

export interface Stqry {
  storage: StqryStorage;
}

declare global {
  interface Window {
    stqry?: Stqry;
    stqryRuntime?: StqryRuntime;
    ReactNativeWebView?: { postMessage(message: string): void };
  }
}

export function getStqry(): Stqry | undefined {
  return typeof window !== 'undefined' ? window.stqry : undefined;
}

/**
 * The official stqry navigation/linking actions are *not* wrapped by the bridge
 * object — they're raw postMessages. Returns false when there's no host (i.e. a
 * plain standalone browser), so callers can apply a sensible web fallback.
 */
function send(action: string, data: Record<string, unknown>): boolean {
  if (typeof window === 'undefined') return false;
  const message = JSON.stringify({ action, version: 'v1', data });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(message);
    return true;
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
    return true;
  }
  return false;
}

/** Jump to another stqry content item (a "room" living in a different cluster). */
export function openInternal(subtype: 'web' | 'story' | 'tour' | 'map', id: number): void {
  send('linking.openInternal', { params: { subtype, id } });
}

export function openExternal(link: string): void {
  if (!send('linking.openExternal', { link }) && typeof window !== 'undefined') {
    window.open(link, '_blank', 'noopener');
  }
}

export function navigationBack(): void {
  if (!send('navigation.back', {}) && typeof window !== 'undefined') {
    window.history.back();
  }
}
