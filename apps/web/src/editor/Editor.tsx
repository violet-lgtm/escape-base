import { useCallback, useState } from 'react';
import { parseGame, type Game, type Hotspot, type Item, type Room } from '@escape/schema';
import { sampleGame } from '../sample-game.js';
import { RoomCanvas } from './RoomCanvas.js';
import { Inspector } from './Inspector.js';
import { TestPlay } from './TestPlay.js';
import './editor.css';

function uniqueId(prefix: string, taken: Set<string>): string {
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

export function Editor() {
  const [game, setGame] = useState<Game>(() => structuredClone(sampleGame));
  const [currentRoomId, setCurrentRoomId] = useState(game.startRoom);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const room = game.rooms.find((r) => r.id === currentRoomId) ?? game.rooms[0]!;
  const selectedHotspot = room.hotspots.find((h) => h.id === selectedHotspotId) ?? null;

  const selectRoom = useCallback((id: string) => {
    setCurrentRoomId(id);
    setSelectedHotspotId(null);
  }, []);

  const patchGame = useCallback((patch: Partial<Game>) => setGame((g) => ({ ...g, ...patch })), []);

  const patchRoom = useCallback((roomId: string, patch: Partial<Room>) => {
    setGame((g) => ({
      ...g,
      rooms: g.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)),
    }));
  }, []);

  const patchHotspot = useCallback((roomId: string, hotspotId: string, patch: Partial<Hotspot>) => {
    setGame((g) => ({
      ...g,
      rooms: g.rooms.map((r) =>
        r.id === roomId
          ? { ...r, hotspots: r.hotspots.map((h) => (h.id === hotspotId ? { ...h, ...patch } : h)) }
          : r,
      ),
    }));
  }, []);

  const addHotspot = useCallback(() => {
    setGame((g) => {
      const r = g.rooms.find((x) => x.id === currentRoomId);
      if (!r) return g;
      const id = uniqueId('hotspot', new Set(r.hotspots.map((h) => h.id)));
      const hotspot: Hotspot = {
        id,
        label: 'New hotspot',
        shape: { type: 'rect', x: 0.4, y: 0.42, w: 0.2, h: 0.16 },
        conditions: [],
        actions: [{ type: 'showMessage', text: 'Hello' }],
      };
      setSelectedHotspotId(id);
      return {
        ...g,
        rooms: g.rooms.map((x) =>
          x.id === r.id ? { ...x, hotspots: [...x.hotspots, hotspot] } : x,
        ),
      };
    });
  }, [currentRoomId]);

  // Upload an SVG/PNG → embed it as a self-contained data URL and drop in a
  // clickable rect hotspot sized to the image's aspect ratio.
  const uploadObject = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const sprite = String(reader.result);
        const place = (aspect: number) => {
          const w = 0.25;
          // Keep the image's pixel aspect within the portrait 720x1280 canvas.
          const h = Math.min(0.7, Math.max(0.05, (w * (720 / 1280)) / (aspect || 1)));
          const label = file.name.replace(/\.[^.]+$/, '');
          setGame((g) => {
            const r = g.rooms.find((x) => x.id === currentRoomId);
            if (!r) return g;
            const id = uniqueId('object', new Set(r.hotspots.map((hs) => hs.id)));
            const hotspot: Hotspot = {
              id,
              label,
              sprite,
              shape: { type: 'rect', x: (1 - w) / 2, y: (1 - h) / 2, w, h },
              conditions: [],
              actions: [{ type: 'showMessage', text: `You see the ${label}.` }],
            };
            setSelectedHotspotId(id);
            return {
              ...g,
              rooms: g.rooms.map((x) =>
                x.id === r.id ? { ...x, hotspots: [...x.hotspots, hotspot] } : x,
              ),
            };
          });
        };
        const img = new Image();
        img.onload = () => place(img.naturalWidth / img.naturalHeight);
        img.onerror = () => place(1);
        img.src = sprite;
      };
      reader.readAsDataURL(file);
    },
    [currentRoomId],
  );

  const deleteHotspot = useCallback(
    (hotspotId: string) => {
      patchRoom(currentRoomId, { hotspots: room.hotspots.filter((h) => h.id !== hotspotId) });
      setSelectedHotspotId((cur) => (cur === hotspotId ? null : cur));
    },
    [currentRoomId, room, patchRoom],
  );

  const addRoom = useCallback(() => {
    setGame((g) => {
      const id = uniqueId('room', new Set(g.rooms.map((r) => r.id)));
      const clusterId = g.clusters[0]!.id;
      const newRoom: Room = { id, clusterId, background: '#222831', hotspots: [] };
      setCurrentRoomId(id);
      setSelectedHotspotId(null);
      return {
        ...g,
        rooms: [...g.rooms, newRoom],
        // keep cluster membership in sync so routing can find the new room
        clusters: g.clusters.map((c) =>
          c.id === clusterId ? { ...c, rooms: [...c.rooms, id] } : c,
        ),
      };
    });
  }, []);

  const addItem = useCallback(() => {
    setGame((g) => {
      const id = uniqueId('item', new Set(g.items.map((i) => i.id)));
      return { ...g, items: [...g.items, { id, name: 'New item' }] };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setGame((g) => ({ ...g, items: g.items.filter((i) => i.id !== id) }));
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<Item>) => {
    setGame((g) => ({ ...g, items: g.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }, []);

  const exportJson = useCallback(() => {
    let validated: Game;
    try {
      validated = parseGame(game);
    } catch (err) {
      alert(`Game is not valid yet:\n${(err as Error).message}`);
      return;
    }
    const blob = new Blob([JSON.stringify(validated, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.id || 'game'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [game]);

  const importJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseGame(JSON.parse(String(reader.result)));
        setGame(parsed);
        setCurrentRoomId(parsed.startRoom);
        setSelectedHotspotId(null);
      } catch (err) {
        alert(`Import failed:\n${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <div className="ed-app">
      <header className="ed-toolbar">
        <strong className="ed-brand">Editor</strong>
        <select value={currentRoomId} onChange={(e) => selectRoom(e.target.value)}>
          {game.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id}
            </option>
          ))}
        </select>
        <button onClick={addRoom}>+ Room</button>
        <button onClick={addHotspot}>+ Hotspot</button>
        <label className="ed-import">
          + Object
          <input
            type="file"
            accept=".svg,.png,image/svg+xml,image/png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadObject(file);
              e.target.value = '';
            }}
          />
        </label>
        <span className="ed-spacer" />
        <button onClick={() => setTesting(true)}>▶ Test play</button>
        <button onClick={exportJson}>Export JSON</button>
        <label className="ed-import">
          Import JSON
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importJson(file);
              e.target.value = '';
            }}
          />
        </label>
      </header>

      <div className="ed-main">
        <div className="ed-stage">
          <RoomCanvas
            room={room}
            selectedId={selectedHotspotId}
            onSelect={setSelectedHotspotId}
            onChangeShape={(hotspotId, shape) => patchHotspot(room.id, hotspotId, { shape })}
          />
        </div>
        <Inspector
          game={game}
          room={room}
          selectedHotspot={selectedHotspot}
          onPatchGame={patchGame}
          onPatchRoom={patchRoom}
          onPatchHotspot={patchHotspot}
          onDeleteHotspot={deleteHotspot}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onPatchItem={patchItem}
        />
      </div>

      {testing && <TestPlay game={game} onClose={() => setTesting(false)} />}
    </div>
  );
}
