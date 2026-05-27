import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '@escape/schema';
import type { GameState } from '@escape/engine';
import { clusterOfRoom, navigateToRoom, resolveEntryRoom } from './routing.js';
import { loadState } from './store.js';

const game: Game = {
  id: 'g',
  title: 'g',
  schemaVersion: 1,
  startRoom: 'lobby',
  items: [],
  clusters: [
    { id: 'hub', stqryId: 100, rooms: ['lobby', 'overview'] },
    { id: 'cellar', stqryId: 200, rooms: ['cellar', 'vault'] },
    { id: 'attic', rooms: ['attic'] }, // intentionally no stqryId
  ],
  rooms: [
    { id: 'lobby', clusterId: 'hub', background: '#111', hotspots: [] },
    { id: 'overview', clusterId: 'hub', background: '#222', hotspots: [] },
    { id: 'cellar', clusterId: 'cellar', background: '#333', hotspots: [] },
    { id: 'vault', clusterId: 'cellar', background: '#444', hotspots: [] },
    { id: 'attic', clusterId: 'attic', background: '#555', hotspots: [] },
  ],
};

const state: GameState = { v: 1, inventory: [], flags: {}, visited: ['lobby'] };

beforeEach(() => {
  localStorage.clear();
  delete window.stqry;
});

describe('clusterOfRoom', () => {
  it('finds the owning cluster', () => {
    expect(clusterOfRoom(game, 'vault')?.id).toBe('cellar');
    expect(clusterOfRoom(game, 'nope')).toBeUndefined();
  });
});

describe('resolveEntryRoom', () => {
  it('prefers a pendingRoom that belongs to this cluster', () => {
    expect(resolveEntryRoom(game, 'cellar', { ...state, pendingRoom: 'vault' })).toBe('vault');
  });

  it('resumes lastRoom when it belongs to this cluster', () => {
    expect(resolveEntryRoom(game, 'cellar', { ...state, lastRoom: 'cellar' })).toBe('cellar');
  });

  it('ignores pending/last rooms from other clusters and uses the default', () => {
    expect(resolveEntryRoom(game, 'cellar', { ...state, lastRoom: 'lobby' })).toBe('cellar');
  });

  it('defaults to the first room when state is null', () => {
    expect(resolveEntryRoom(game, 'hub', null)).toBe('lobby');
  });
});

describe('navigateToRoom', () => {
  it('routes locally within the same cluster and persists state', async () => {
    const onLocalRoom = vi.fn();
    await navigateToRoom(
      { game, gameId: 'g', currentClusterId: 'hub', onLocalRoom },
      state,
      'overview',
    );
    expect(onLocalRoom).toHaveBeenCalledWith('overview');
    expect((await loadState('g'))?.lastRoom).toBe('overview');
  });

  it('hands the target to the next cluster via pendingRoom on a cross-cluster jump', async () => {
    const onLocalRoom = vi.fn();
    await navigateToRoom(
      { game, gameId: 'g', currentClusterId: 'hub', onLocalRoom },
      state,
      'vault',
    );
    expect(onLocalRoom).not.toHaveBeenCalled();
    expect((await loadState('g'))?.pendingRoom).toBe('vault');
  });

  it('throws when crossing into a cluster that has no stqryId', async () => {
    const deps = { game, gameId: 'g', currentClusterId: 'hub', onLocalRoom: vi.fn() };
    await expect(navigateToRoom(deps, state, 'attic')).rejects.toThrow(/no stqryId/);
  });
});
