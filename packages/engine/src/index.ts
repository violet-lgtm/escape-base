import type { Action, Condition, Game, FlagValue, Hotspot } from '@escape/schema';

/**
 * Runtime state of a play session. This is the *only* thing that needs to
 * persist (via stqry.storage) for inventory to survive across room page loads.
 */
export interface GameState {
  v: 1;
  inventory: string[];
  flags: Record<string, FlagValue>;
  visited: string[];
  /** Last room the player was in — enables resume. */
  lastRoom?: string;
  /** Target room handed to the next cluster across a stqry navigation boundary. */
  pendingRoom?: string;
}

export function freshState(game: Game): GameState {
  return { v: 1, inventory: [], flags: {}, visited: [game.startRoom], lastRoom: game.startRoom };
}

/**
 * Side effects the host must carry out after a state transition. Kept separate
 * from state so the engine stays pure: navigation, messages and audio are the
 * host's job (routing module, UI, Howler), not the reducer's.
 */
export type Effect =
  | { type: 'navigate'; room: string }
  | { type: 'message'; text: string }
  | { type: 'sound'; src: string }
  | { type: 'win' };

export function evaluateCondition(state: GameState, cond: Condition): boolean {
  switch (cond.type) {
    case 'hasItem':
      return state.inventory.includes(cond.item);
    case 'notItem':
      return !state.inventory.includes(cond.item);
    case 'flag':
      return state.flags[cond.key] === cond.equals;
    case 'notFlag':
      return state.flags[cond.key] === undefined;
  }
}

/** A hotspot fires only when every one of its conditions passes. */
export function canActivate(state: GameState, hotspot: Hotspot): boolean {
  return hotspot.conditions.every((c) => evaluateCondition(state, c));
}

function applyAction(state: GameState, action: Action): { state: GameState; effects: Effect[] } {
  switch (action.type) {
    case 'addItem':
      if (state.inventory.includes(action.item)) return { state, effects: [] };
      return { state: { ...state, inventory: [...state.inventory, action.item] }, effects: [] };
    case 'removeItem':
      return {
        state: { ...state, inventory: state.inventory.filter((i) => i !== action.item) },
        effects: [],
      };
    case 'setFlag':
      return {
        state: { ...state, flags: { ...state.flags, [action.key]: action.value } },
        effects: [],
      };
    case 'goToRoom': {
      const visited = state.visited.includes(action.room)
        ? state.visited
        : [...state.visited, action.room];
      return {
        state: { ...state, visited, lastRoom: action.room },
        effects: [{ type: 'navigate', room: action.room }],
      };
    }
    case 'showMessage':
      return { state, effects: [{ type: 'message', text: action.text }] };
    case 'playSound':
      return { state, effects: [{ type: 'sound', src: action.src }] };
    case 'win':
      return { state, effects: [{ type: 'win' }] };
  }
}

/**
 * Run a hotspot: if its conditions don't pass, nothing happens. Otherwise fold
 * its actions in order, threading state and collecting effects.
 */
export function activateHotspot(
  state: GameState,
  hotspot: Hotspot,
): { state: GameState; effects: Effect[] } {
  if (!canActivate(state, hotspot)) return { state, effects: [] };

  let next = state;
  const effects: Effect[] = [];
  for (const action of hotspot.actions) {
    const result = applyAction(next, action);
    next = result.state;
    effects.push(...result.effects);
  }
  return { state: next, effects };
}
