import { describe, expect, it } from 'vitest';
import type { Game, Hotspot } from '@escape/schema';
import { activateHotspot, canActivate, freshState, type GameState } from './index.js';

const game: Game = {
  id: 'g',
  title: 'g',
  schemaVersion: 1,
  startRoom: 'lobby',
  items: [],
  clusters: [{ id: 'hub', rooms: ['lobby'] }],
  rooms: [{ id: 'lobby', clusterId: 'hub', background: '#000', hotspots: [] }],
};

const base = (): GameState => freshState(game);

const hotspot = (overrides: Partial<Hotspot>): Hotspot => ({
  id: 'h',
  shape: { type: 'rect', x: 0, y: 0, w: 0.1, h: 0.1 },
  conditions: [],
  actions: [{ type: 'showMessage', text: 'hi' }],
  ...overrides,
});

describe('engine', () => {
  it('freshState marks the start room visited', () => {
    expect(base().visited).toEqual(['lobby']);
  });

  it('addItem is idempotent', () => {
    const h = hotspot({ actions: [{ type: 'addItem', item: 'key' }] });
    const once = activateHotspot(base(), h).state;
    const twice = activateHotspot(once, h).state;
    expect(twice.inventory).toEqual(['key']);
  });

  it('gates hotspots on conditions', () => {
    const h = hotspot({
      conditions: [{ type: 'hasItem', item: 'key' }],
      actions: [{ type: 'win' }],
    });
    expect(canActivate(base(), h)).toBe(false);
    expect(activateHotspot(base(), h).effects).toEqual([]);

    const withKey: GameState = { ...base(), inventory: ['key'] };
    expect(activateHotspot(withKey, h).effects).toEqual([{ type: 'win' }]);
  });

  it('folds multiple actions, threading state and collecting effects', () => {
    const h = hotspot({
      actions: [
        { type: 'addItem', item: 'coin' },
        { type: 'setFlag', key: 'opened', value: true },
        { type: 'goToRoom', room: 'cellar' },
      ],
    });
    const { state, effects } = activateHotspot(base(), h);
    expect(state.inventory).toEqual(['coin']);
    expect(state.flags.opened).toBe(true);
    expect(state.lastRoom).toBe('cellar');
    expect(state.visited).toContain('cellar');
    expect(effects).toEqual([{ type: 'navigate', room: 'cellar' }]);
  });

  it('notFlag passes only while the flag is unset', () => {
    const h = hotspot({
      conditions: [{ type: 'notFlag', key: 'opened' }],
      actions: [{ type: 'win' }],
    });
    expect(canActivate(base(), h)).toBe(true);
    expect(canActivate({ ...base(), flags: { opened: true } }, h)).toBe(false);
  });
});
