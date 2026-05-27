import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Hotspot } from '@escape/schema';
import {
  activateHotspot,
  canActivate,
  freshState,
  type Effect,
  type GameState,
} from '@escape/engine';
import {
  clearState,
  clusterOfRoom,
  loadState,
  navigateToRoom,
  resolveEntryRoom,
  saveState,
} from '@escape/storage';
import { GAME_ID, sampleGame } from './sample-game.js';
import { PixiRoom } from './PixiRoom.js';
import { assetUrl } from './assets.js';

/** No stqry bridge and no parent frame → a plain dev browser. */
function isStandalone(): boolean {
  return typeof window !== 'undefined' && !window.stqry && window.parent === window;
}

export function App() {
  const game = sampleGame;

  // Which cluster this page serves. In real stqry each cluster is its own web
  // item; in dev we emulate that with a ?cluster= query param.
  const currentClusterId = useMemo(() => {
    const param = new URLSearchParams(window.location.search).get('cluster');
    return param ?? clusterOfRoom(game, game.startRoom)?.id ?? game.clusters[0]!.id;
  }, [game]);

  // Testing-only: a reset affordance, shown only with ?debug in the URL so it
  // never appears in the shipped product.
  const debug = useMemo(() => new URLSearchParams(window.location.search).has('debug'), []);

  const [state, setState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [won, setWon] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = (await loadState(GAME_ID)) ?? freshState(game);
      const entry = resolveEntryRoom(game, currentClusterId, loaded);
      let next = loaded;
      if (loaded.pendingRoom === entry) {
        next = { ...loaded, pendingRoom: undefined };
        await saveState(GAME_ID, next);
      }
      if (cancelled) return;
      setState(next);
      setRoomId(entry);
    })();
    return () => {
      cancelled = true;
    };
  }, [game, currentClusterId]);

  const room = roomId ? (game.rooms.find((r) => r.id === roomId) ?? null) : null;

  const runEffects = useCallback(
    async (effects: Effect[], nextState: GameState) => {
      for (const effect of effects) {
        if (effect.type === 'message') {
          setMessage(effect.text);
        } else if (effect.type === 'win') {
          setWon(true);
        } else if (effect.type === 'navigate') {
          const targetCluster = clusterOfRoom(game, effect.room);
          const crossing = targetCluster !== undefined && targetCluster.id !== currentClusterId;
          await navigateToRoom(
            { game, gameId: GAME_ID, currentClusterId, onLocalRoom: setRoomId },
            nextState,
            effect.room,
          );
          // Real stqry already hopped via openInternal. In dev, emulate the
          // separate-page-load with a real reload; pendingRoom is already saved.
          if (crossing && targetCluster && isStandalone()) {
            window.location.assign(`${window.location.pathname}?cluster=${targetCluster.id}`);
          }
        }
        // 'sound' is wired to Howler in a later phase.
      }
    },
    [game, currentClusterId],
  );

  const onHotspot = useCallback(
    (hotspot: Hotspot) => {
      if (!state) return;
      const { state: next, effects } = activateHotspot(state, hotspot);
      setState(next);
      setMessage('');
      void saveState(GAME_ID, next);
      void runEffects(effects, next);
    },
    [state, runEffects],
  );

  const onReset = useCallback(async () => {
    await clearState(GAME_ID);
    const fresh = freshState(game);
    setState(fresh);
    setRoomId(resolveEntryRoom(game, currentClusterId, fresh));
    setMessage('');
    setWon(false);
  }, [game, currentClusterId]);

  const revision = useMemo(
    () => (state ? JSON.stringify([state.inventory, state.flags]) : ''),
    [state],
  );

  if (!state || !room) return <div className="loading">Loading…</div>;

  return (
    <div className="app">
      <PixiRoom
        key={room.id}
        room={room}
        revision={revision}
        isActive={(hotspot) => canActivate(state, hotspot)}
        onHotspot={onHotspot}
      />

      <header className="hud">
        <span className="title">{game.title}</span>
        <span className="hud-right">
          <span className="room">{room.id}</span>
          {debug && (
            <button className="reset" onClick={() => void onReset()}>
              ↻ Reset
            </button>
          )}
        </span>
      </header>

      <footer className="inventory">
        {state.inventory.length === 0 ? (
          <span className="empty">Inventory empty</span>
        ) : (
          state.inventory.map((id) => {
            const item = game.items.find((i) => i.id === id);
            return (
              <span key={id} className="item">
                {item?.icon && <img className="item-icon" src={assetUrl(item.icon)} alt="" />}
                {item?.name ?? id}
              </span>
            );
          })
        )}
      </footer>

      {message && (
        <div className="toast" onClick={() => setMessage('')}>
          {message}
        </div>
      )}

      {won && (
        <div className="overlay">
          <div className="win">You escaped! 🎉</div>
        </div>
      )}
    </div>
  );
}
