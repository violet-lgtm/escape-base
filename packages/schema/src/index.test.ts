import { describe, expect, it } from 'vitest';
import { parseGame, type Game } from './index.js';

const valid: Game = {
  id: 'demo',
  title: 'Demo',
  schemaVersion: 1,
  startRoom: 'lobby',
  items: [{ id: 'key', name: 'Rusty Key' }],
  clusters: [{ id: 'hub', stqryId: 1, rooms: ['lobby'] }],
  rooms: [
    {
      id: 'lobby',
      clusterId: 'hub',
      background: '#222',
      hotspots: [
        {
          id: 'door',
          shape: { x: 0.1, y: 0.1, w: 0.2, h: 0.4 },
          conditions: [{ type: 'hasItem', item: 'key' }],
          actions: [{ type: 'win' }],
        },
      ],
    },
  ],
};

describe('gameSchema', () => {
  it('accepts a well-formed game', () => {
    expect(() => parseGame(valid)).not.toThrow();
  });

  it('applies defaults for omitted optional arrays', () => {
    const game = parseGame({ ...valid, items: undefined });
    expect(game.items).toEqual([]);
  });

  it('rejects out-of-range hotspot coordinates', () => {
    const bad = structuredClone(valid);
    bad.rooms[0]!.hotspots[0]!.shape.x = 1.5;
    expect(() => parseGame(bad)).toThrow();
  });

  it('rejects a hotspot with no actions', () => {
    const bad = structuredClone(valid);
    bad.rooms[0]!.hotspots[0]!.actions = [];
    expect(() => parseGame(bad)).toThrow();
  });
});
