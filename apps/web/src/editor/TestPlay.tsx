import { useCallback, useState } from 'react';
import type { Game, Hotspot } from '@escape/schema';
import { activateHotspot, canActivate, freshState, type GameState } from '@escape/engine';
import { PixiRoom } from '../PixiRoom.js';
import { assetUrl } from '../assets.js';

/**
 * Plays the in-progress game with the real Pixi renderer and engine, entirely
 * in memory — no storage, no stqry navigation. `goToRoom` just switches rooms
 * locally so the creator can test puzzle logic and flow. Reopen to restart.
 */
export function TestPlay({ game, onClose }: { game: Game; onClose: () => void }) {
  const [state, setState] = useState<GameState>(() => freshState(game));
  const [roomId, setRoomId] = useState(game.startRoom);
  const [message, setMessage] = useState('');
  const [won, setWon] = useState(false);

  const room = game.rooms.find((r) => r.id === roomId) ?? game.rooms[0];

  const onHotspot = useCallback(
    (hotspot: Hotspot) => {
      const { state: next, effects } = activateHotspot(state, hotspot);
      setState(next);
      setMessage('');
      for (const effect of effects) {
        if (effect.type === 'message') setMessage(effect.text);
        else if (effect.type === 'win') setWon(true);
        else if (effect.type === 'navigate') setRoomId(effect.room);
      }
    },
    [state],
  );

  if (!room) return null;
  const revision = JSON.stringify([state.inventory, state.flags, roomId]);

  return (
    <div className="testplay">
      <PixiRoom
        key={room.id}
        room={room}
        revision={revision}
        isActive={(h) => canActivate(state, h)}
        onHotspot={onHotspot}
      />

      <header className="hud">
        <span className="title">Test play</span>
        <span className="room">{room.id}</span>
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

      <button className="testplay-close" onClick={onClose}>
        ✕ Close
      </button>
    </div>
  );
}
