import type { Action, Condition, Game, Hotspot, Item, Room } from '@escape/schema';

const ACTION_TYPES: Action['type'][] = [
  'showMessage',
  'addItem',
  'removeItem',
  'setFlag',
  'goToRoom',
  'playSound',
  'win',
];
const CONDITION_TYPES: Condition['type'][] = ['hasItem', 'notItem', 'flag', 'notFlag'];

const ASSET_SUGGESTIONS = [
  'assets/lobby.svg',
  'assets/overview.svg',
  'assets/cellar.svg',
  'assets/vault.svg',
];

function defaultAction(type: Action['type']): Action {
  switch (type) {
    case 'addItem':
      return { type, item: '' };
    case 'removeItem':
      return { type, item: '' };
    case 'setFlag':
      return { type, key: '', value: '' };
    case 'goToRoom':
      return { type, room: '' };
    case 'showMessage':
      return { type, text: '' };
    case 'playSound':
      return { type, src: '' };
    case 'win':
      return { type };
  }
}

function defaultCondition(type: Condition['type']): Condition {
  switch (type) {
    case 'hasItem':
      return { type, item: '' };
    case 'notItem':
      return { type, item: '' };
    case 'flag':
      return { type, key: '', equals: '' };
    case 'notFlag':
      return { type, key: '' };
  }
}

function ItemSelect({
  game,
  value,
  onChange,
}: {
  game: Game;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— item —</option>
      {game.items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name}
        </option>
      ))}
    </select>
  );
}

function RoomSelect({
  game,
  value,
  onChange,
}: {
  game: Game;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— room —</option>
      {game.rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {r.id}
        </option>
      ))}
    </select>
  );
}

function ActionFields({
  action,
  game,
  onChange,
}: {
  action: Action;
  game: Game;
  onChange: (a: Action) => void;
}) {
  switch (action.type) {
    case 'addItem':
    case 'removeItem':
      return (
        <ItemSelect
          game={game}
          value={action.item}
          onChange={(item) => onChange({ ...action, item })}
        />
      );
    case 'setFlag':
      return (
        <>
          <input
            placeholder="flag"
            value={action.key}
            onChange={(e) => onChange({ ...action, key: e.target.value })}
          />
          <input
            placeholder="value"
            value={String(action.value)}
            onChange={(e) => onChange({ ...action, value: e.target.value })}
          />
        </>
      );
    case 'goToRoom':
      return (
        <RoomSelect
          game={game}
          value={action.room}
          onChange={(room) => onChange({ ...action, room })}
        />
      );
    case 'showMessage':
      return (
        <input
          placeholder="message"
          value={action.text}
          onChange={(e) => onChange({ ...action, text: e.target.value })}
        />
      );
    case 'playSound':
      return (
        <input
          placeholder="sound src"
          value={action.src}
          onChange={(e) => onChange({ ...action, src: e.target.value })}
        />
      );
    case 'win':
      return null;
  }
}

function ConditionFields({
  cond,
  game,
  onChange,
}: {
  cond: Condition;
  game: Game;
  onChange: (c: Condition) => void;
}) {
  switch (cond.type) {
    case 'hasItem':
    case 'notItem':
      return (
        <ItemSelect
          game={game}
          value={cond.item}
          onChange={(item) => onChange({ ...cond, item })}
        />
      );
    case 'flag':
      return (
        <>
          <input
            placeholder="flag"
            value={cond.key}
            onChange={(e) => onChange({ ...cond, key: e.target.value })}
          />
          <input
            placeholder="equals"
            value={String(cond.equals)}
            onChange={(e) => onChange({ ...cond, equals: e.target.value })}
          />
        </>
      );
    case 'notFlag':
      return (
        <input
          placeholder="flag"
          value={cond.key}
          onChange={(e) => onChange({ ...cond, key: e.target.value })}
        />
      );
  }
}

interface InspectorProps {
  game: Game;
  room: Room;
  selectedHotspot: Hotspot | null;
  onPatchGame: (patch: Partial<Game>) => void;
  onPatchRoom: (roomId: string, patch: Partial<Room>) => void;
  onPatchHotspot: (roomId: string, hotspotId: string, patch: Partial<Hotspot>) => void;
  onDeleteHotspot: (hotspotId: string) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onPatchItem: (id: string, patch: Partial<Item>) => void;
}

export function Inspector(props: InspectorProps) {
  const { game, room, selectedHotspot } = props;

  if (selectedHotspot) {
    const h = selectedHotspot;
    const patch = (p: Partial<Hotspot>) => props.onPatchHotspot(room.id, h.id, p);
    return (
      <aside className="ed-inspector">
        <h2>Hotspot</h2>

        <label className="ed-field">
          <span>Label</span>
          <input value={h.label ?? ''} onChange={(e) => patch({ label: e.target.value })} />
        </label>

        <div className="ed-section-head">
          <h3>Conditions</h3>
          <button
            onClick={() => patch({ conditions: [...h.conditions, defaultCondition('hasItem')] })}
          >
            + add
          </button>
        </div>
        {h.conditions.length === 0 && <p className="ed-muted">Always active.</p>}
        {h.conditions.map((c, i) => (
          <div className="ed-row" key={i}>
            <select
              value={c.type}
              onChange={(e) =>
                patch({
                  conditions: h.conditions.map((x, j) =>
                    j === i ? defaultCondition(e.target.value as Condition['type']) : x,
                  ),
                })
              }
            >
              {CONDITION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ConditionFields
              cond={c}
              game={game}
              onChange={(nc) =>
                patch({ conditions: h.conditions.map((x, j) => (j === i ? nc : x)) })
              }
            />
            <button
              className="ed-x"
              onClick={() => patch({ conditions: h.conditions.filter((_, j) => j !== i) })}
            >
              ✕
            </button>
          </div>
        ))}

        <div className="ed-section-head">
          <h3>Actions</h3>
          <button onClick={() => patch({ actions: [...h.actions, defaultAction('showMessage')] })}>
            + add
          </button>
        </div>
        {h.actions.map((a, i) => (
          <div className="ed-row" key={i}>
            <select
              value={a.type}
              onChange={(e) =>
                patch({
                  actions: h.actions.map((x, j) =>
                    j === i ? defaultAction(e.target.value as Action['type']) : x,
                  ),
                })
              }
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ActionFields
              action={a}
              game={game}
              onChange={(na) => patch({ actions: h.actions.map((x, j) => (j === i ? na : x)) })}
            />
            <button
              className="ed-x"
              disabled={h.actions.length <= 1}
              title={h.actions.length <= 1 ? 'A hotspot needs at least one action' : 'Remove'}
              onClick={() => patch({ actions: h.actions.filter((_, j) => j !== i) })}
            >
              ✕
            </button>
          </div>
        ))}

        <button className="ed-danger" onClick={() => props.onDeleteHotspot(h.id)}>
          Delete hotspot
        </button>
      </aside>
    );
  }

  // Nothing selected → game / room / items panel.
  return (
    <aside className="ed-inspector">
      <h2>Game</h2>
      <label className="ed-field">
        <span>Title</span>
        <input value={game.title} onChange={(e) => props.onPatchGame({ title: e.target.value })} />
      </label>

      <h3>Room: {room.id}</h3>
      <label className="ed-field">
        <span>Background</span>
        <input
          list="ed-assets"
          value={room.background}
          onChange={(e) => props.onPatchRoom(room.id, { background: e.target.value })}
        />
        <datalist id="ed-assets">
          {ASSET_SUGGESTIONS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </label>
      <label className="ed-field">
        <span>Cluster</span>
        <select
          value={room.clusterId}
          onChange={(e) => props.onPatchRoom(room.id, { clusterId: e.target.value })}
        >
          {game.clusters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}
            </option>
          ))}
        </select>
      </label>

      <div className="ed-section-head">
        <h3>Items</h3>
        <button onClick={props.onAddItem}>+ add</button>
      </div>
      {game.items.map((item) => (
        <div className="ed-row" key={item.id}>
          <input
            value={item.name}
            onChange={(e) => props.onPatchItem(item.id, { name: e.target.value })}
          />
          <input
            placeholder="icon"
            value={item.icon ?? ''}
            onChange={(e) => props.onPatchItem(item.id, { icon: e.target.value || undefined })}
          />
          <button className="ed-x" onClick={() => props.onRemoveItem(item.id)}>
            ✕
          </button>
        </div>
      ))}
      <p className="ed-muted">Tip: click a hotspot to edit it, or use “+ Hotspot”.</p>
    </aside>
  );
}
