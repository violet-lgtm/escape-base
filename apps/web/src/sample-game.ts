import { parseGame, type Game } from '@escape/schema';

/** Stable across every room page so they share one stqry storage entry. */
export const GAME_ID = 'sample-escape';

/**
 * A tiny two-cluster game that exercises the whole pipeline:
 *
 *   hub    (stqry item 57959): lobby ↔ overview          — same-cluster routing
 *   cellar (stqry item 57882): cellar → vault            — same-cluster routing
 *   lobby --(needs key)--> cellar                        — cross-cluster stqry hop
 *
 * Inventory (key, coin) is carried across the cluster boundary via storage.
 */
export const sampleGame: Game = parseGame({
  id: GAME_ID,
  title: 'The Cellar',
  schemaVersion: 1,
  startRoom: 'lobby',
  items: [
    { id: 'key', name: 'Rusty Key', icon: 'assets/key.svg' },
    { id: 'coin', name: 'Gold Coin', icon: 'assets/coin.svg' },
  ],
  clusters: [
    { id: 'hub', stqryId: 57959, entryUrl: '/c/hub', rooms: ['lobby', 'overview'] },
    { id: 'cellar', stqryId: 57882, entryUrl: '/c/cellar', rooms: ['cellar', 'vault'] },
  ],
  rooms: [
    {
      id: 'lobby',
      clusterId: 'hub',
      background: 'assets/lobby.svg',
      hotspots: [
        {
          id: 'drawer',
          label: 'Drawer',
          shape: { type: 'rect', x: 0.08, y: 0.55, w: 0.26, h: 0.22 },
          conditions: [{ type: 'notItem', item: 'key' }],
          actions: [
            { type: 'addItem', item: 'key' },
            { type: 'showMessage', text: 'You found a rusty key.' },
          ],
        },
        {
          id: 'to-overview',
          label: 'Look around',
          shape: { type: 'rect', x: 0.7, y: 0.1, w: 0.22, h: 0.16 },
          actions: [{ type: 'goToRoom', room: 'overview' }],
        },
        {
          id: 'cellar-door',
          label: 'Cellar door',
          shape: { type: 'rect', x: 0.4, y: 0.3, w: 0.2, h: 0.45 },
          conditions: [{ type: 'hasItem', item: 'key' }],
          actions: [{ type: 'goToRoom', room: 'cellar' }],
        },
      ],
    },
    {
      id: 'overview',
      clusterId: 'hub',
      background: 'assets/overview.svg',
      hotspots: [
        {
          id: 'back-to-lobby',
          label: 'Back',
          shape: { type: 'rect', x: 0.06, y: 0.08, w: 0.2, h: 0.14 },
          actions: [{ type: 'goToRoom', room: 'lobby' }],
        },
      ],
    },
    {
      id: 'cellar',
      clusterId: 'cellar',
      background: 'assets/cellar.svg',
      hotspots: [
        {
          id: 'coin-pickup',
          label: 'Gold coin',
          shape: { type: 'rect', x: 0.7, y: 0.46, w: 0.12, h: 0.07 },
          sprite: 'assets/coin.svg',
          conditions: [{ type: 'notItem', item: 'coin' }],
          actions: [
            { type: 'addItem', item: 'coin' },
            { type: 'showMessage', text: 'You pocket the gold coin.' },
          ],
        },
        {
          id: 'to-vault',
          label: 'Vault door',
          shape: { type: 'rect', x: 0.1, y: 0.3, w: 0.22, h: 0.45 },
          actions: [{ type: 'goToRoom', room: 'vault' }],
        },
      ],
    },
    {
      id: 'vault',
      clusterId: 'cellar',
      background: 'assets/vault.svg',
      hotspots: [
        {
          id: 'chest',
          label: 'Locked chest',
          shape: {
            type: 'polygon',
            points: [
              { x: 0.37, y: 0.56 },
              { x: 0.5, y: 0.5 },
              { x: 0.63, y: 0.56 },
              { x: 0.64, y: 0.73 },
              { x: 0.36, y: 0.73 },
            ],
          },
          conditions: [{ type: 'hasItem', item: 'coin' }],
          actions: [
            { type: 'showMessage', text: 'The coin fits a slot. The chest clicks open!' },
            { type: 'win' },
          ],
        },
      ],
    },
  ],
});
