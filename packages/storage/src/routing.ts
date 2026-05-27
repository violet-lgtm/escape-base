import type { Cluster, Game } from '@escape/schema';
import type { GameState } from '@escape/engine';
import { openInternal } from './stqry.js';
import { saveState } from './store.js';

export function clusterOfRoom(game: Game, roomId: string): Cluster | undefined {
  return game.clusters.find((c) => c.rooms.includes(roomId));
}

/**
 * On boot, pick which room this cluster's page should show. A cross-cluster jump
 * can only address the stqry item, not a specific sub-room, so the target is
 * handed over via `state.pendingRoom`; otherwise resume `lastRoom`, else default.
 */
export function resolveEntryRoom(
  game: Game,
  currentClusterId: string,
  state: GameState | null,
): string {
  const cluster = game.clusters.find((c) => c.id === currentClusterId);
  const fallback = cluster?.rooms[0] ?? game.startRoom;
  if (!state) return fallback;

  const inThisCluster = (room: string | undefined): room is string =>
    room !== undefined && clusterOfRoom(game, room)?.id === currentClusterId;

  if (inThisCluster(state.pendingRoom)) return state.pendingRoom;
  if (inThisCluster(state.lastRoom)) return state.lastRoom;
  return fallback;
}

export interface NavigateDeps {
  game: Game;
  gameId: string;
  currentClusterId: string;
  /** Same-cluster room change, handled in-app (SPA route or setState). */
  onLocalRoom: (room: string) => void;
}

/**
 * Move to a room, transparently choosing self-routing (same cluster) vs a stqry
 * hop (different cluster). State is persisted *before* navigating, since a
 * cross-cluster jump tears down the current page.
 */
export async function navigateToRoom(
  deps: NavigateDeps,
  state: GameState,
  target: string,
): Promise<void> {
  const targetCluster = clusterOfRoom(deps.game, target);
  if (!targetCluster) throw new Error(`Unknown room: ${target}`);

  if (targetCluster.id === deps.currentClusterId) {
    await saveState(deps.gameId, { ...state, lastRoom: target });
    deps.onLocalRoom(target);
    return;
  }

  if (targetCluster.stqryId === undefined) {
    throw new Error(`Cluster "${targetCluster.id}" has no stqryId; cannot cross-navigate.`);
  }
  await saveState(deps.gameId, { ...state, lastRoom: target, pendingRoom: target });
  openInternal('web', targetCluster.stqryId);
}
