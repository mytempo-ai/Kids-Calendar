/* global React, ReactDOM */
const { useState, useEffect, useMemo } = React;

// ============ THEME ============
// Original "Speed & Stars" kids theme — pixel-art adventure + arcade racing
// All artwork is original SVG, no branded characters or vehicles.

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_FULL = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

const CHORES = [
  { id: "bed", label: "Make bed", icon: "🛏️" },
  { id: "teeth", label: "Brush teeth", icon: "🪥" },
  { id: "homework", label: "Homework", icon: "📚" },
  { id: "tidy", label: "Tidy room", icon: "🧹" },
  { id: "kind", label: "Be kind", icon: "💛" },
];

const KIDS = [
  {
    id: "raffi",
    name: "Raffi",
    color: "#E63946",      // race red
    colorDark: "#9B1B26",
    accent: "#FFD23F",
    avatar: "racer",
  },
  {
    id: "tigran",
    name: "Tigran",
    color: "#2EC4B6",      // turbo teal
    colorDark: "#1A7C73",
    accent: "#9BF6FF",
    avatar: "hero",
  },
];

// ============ STORAGE ============
const STORAGE_KEY = "kidcal:v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // shape: { [kidId]: { [day]: { [choreId]: bool } } }
  const empty = {};
  for (const kid of KIDS) {
    empty[kid.id] = {};
    for (const day of DAYS) {
      empty[kid.id][day] = {};
      for (const c of CHORES) empty[kid.id][day][c.id] = false;
    }
  }
  return empty;
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

// ============ ART ============
// Pixel-art style avatars built from CSS box-shadow for true 8-bit feel.
function PixelAvatar({ kind, size = 48 }) {
  // Each avatar is a 12x12 grid of "pixels"
  const grids = {
    racer: [
      // Red helmet racer with goggles
      "............",
      "...111111...",
      "..11111111..",
      ".1133333311.",
      ".1322222231.",
      ".1322442231.",
      ".1322442231.",
      ".1322222231.",
      "..44455544..",
      "..45555554..",
      "...55555....",
      "....555.....",
    ],
    hero: [
      // Teal cape hero with star
      "............",
      "....2222....",
      "...222222...",
      "..22555522..",
      "..25255252..",
      "..22555522..",
      "...666666...",
      "..62266226..",
      "..62266226..",
      "...22..22...",
      "...33..33...",
      "...33..33...",
    ],
  };
  const palette = {
    racer: { 1: "#E63946", 2: "#FFD23F", 3: "#1D3557", 4: "#FFB7B7", 5: "#3A0E0E" },
    hero:  { 1: "transparent", 2: "#2EC4B6", 5: "#FFD23F", 6: "#FFB7B7", 3: "#1D3557" },
  };
  const grid = grids[kind];
  const colors = palette[kind];
  const px = size / 12;
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        imageRendering: "pixelated",
      }}
    >
      {grid.map((row, y) =>
        row.split("").map((ch, x) => {
          if (ch === ".") return null;
          return (
            <div
              key={`${x}-${y}`}
              style={{
                position: "absolute",
                left: x * px,
                top: y * px,
                width: px + 0.5,
                height: px + 0.5,
                background: colors[ch] || "#000",
              }}
            />
          );
        })
      )}
    </div>
  );
}

function PixelStar({ size = 32, lit = true, glint = false }) {
  // Gold pixel star
  const grid = [
    ".....11.....",
    "....1111....",
    "....1331....",
    "11111331111.",
    ".1133333311.",
    "..133333331.",
    "...1133311..",
    "..113311311.",
    ".11.1331.11.",
    "11..1331..11",
    ".....11.....",
    "............",
  ];
  const palette = lit
    ? { 1: "#1D3557", 3: "#FFD23F" } // outline + fill
    : { 1: "#3A3A4A", 3: "#1A1A2A" };
  if (lit && glint) palette[3] = "#FFE873";

  const px = size / 12;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      {grid.map((row, y) =>
        row.split("").map((ch, x) => {
          if (ch === ".") return null;
          return (
            <div
              key={`${x}-${y}`}
              style={{
                position: "absolute",
                left: x * px,
                top: y * px,
                width: px + 0.5,
                height: px + 0.5,
                background: palette[ch] || "#000",
              }}
            />
          );
        })
      )}
      {lit && glint && (
        <div
          style={{
            position: "absolute",
            inset: -px * 2,
            background: "radial-gradient(circle, rgba(255,210,63,0.4), transparent 60%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

function CheckerFlag({ width = 80, height = 16 }) {
  // Racing checker stripe
  const cells = 20;
  const cellW = width / cells;
  return (
    <div style={{ width, height, display: "flex", flexWrap: "wrap" }}>
      {Array.from({ length: cells * 2 }).map((_, i) => {
        const row = Math.floor(i / cells);
        const col = i % cells;
        const black = (row + col) % 2 === 0;
        return (
          <div
            key={i}
            style={{
              width: cellW,
              height: height / 2,
              background: black ? "#1D3557" : "#fff",
            }}
          />
        );
      })}
    </div>
  );
}

// Coin/star burst animation overlay
function StarBurst({ x, y, color }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "none",
        zIndex: 100,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="burst-ring" style={{ borderColor: color }} />
      <div className="burst-star">
        <PixelStar size={48} lit glint />
      </div>
      <div className="burst-plus" style={{ color }}>+1</div>
    </div>
  );
}

// ============ CARDS ============

function ChoreCell({ checked, onToggle, chore, color, locked }) {
  return (
    <button
      className={`chore-cell ${checked ? "checked" : ""} ${locked ? "locked" : ""}`}
      onClick={onToggle}
      disabled={locked}
      style={{ "--kid-color": color }}
      aria-label={chore.label}
      title={chore.label}
    >
      <div className="chore-icon">{chore.icon}</div>
      {checked && (
        <div className="chore-star">
          <PixelStar size={22} lit />
        </div>
      )}
    </button>
  );
}

function DayColumn({ day, isToday, kid, dayState, onToggle, adminMode }) {
  const earned = CHORES.filter((c) => dayState[c.id]).length;
  const total = CHORES.length;
  const complete = earned === total;
  return (
    <div className={`day-col ${isToday ? "today" : ""} ${complete ? "complete" : ""}`}>
      <div className="day-header">
        <div className="day-name">{day}</div>
        {isToday && <div className="day-today-pill">TODAY</div>}
      </div>
      <div className="day-chores">
        {CHORES.map((c) => (
          <ChoreCell
            key={c.id}
            chore={c}
            checked={dayState[c.id]}
            color={kid.color}
            locked={!adminMode}
            onToggle={(e) => onToggle(c.id, e)}
          />
        ))}
      </div>
      <div className="day-tally">
        <span className="day-tally-num" style={{ color: complete ? "#FFD23F" : "var(--ink)" }}>
          {earned}
        </span>
        <span className="day-tally-slash">/{total}</span>
        {complete && <div className="day-complete-flag"><CheckerFlag width={48} height={10} /></div>}
      </div>
    </div>
  );
}

function KidLane({ kid, kidState, onToggle, adminMode, todayDay }) {
  const total = useMemo(() => {
    let t = 0;
    for (const day of DAYS) for (const c of CHORES) if (kidState[day][c.id]) t++;
    return t;
  }, [kidState]);
  const max = DAYS.length * CHORES.length;
  const pct = (total / max) * 100;

  return (
    <section className="kid-lane" style={{ "--kid-color": kid.color, "--kid-dark": kid.colorDark, "--kid-accent": kid.accent }}>
      <div className="kid-banner">
        <div className="kid-banner-left">
          <div className="kid-avatar-frame">
            <PixelAvatar kind={kid.avatar} size={64} />
          </div>
          <div className="kid-name-block">
            <div className="kid-name-tag">PLAYER</div>
            <div className="kid-name">{kid.name}</div>
          </div>
        </div>
        <div className="kid-banner-right">
          <div className="kid-score-card">
            <div className="kid-score-label">★ STARS</div>
            <div className="kid-score-num">{total}</div>
            <div className="kid-score-max">of {max}</div>
          </div>
          <div className="kid-progress">
            <div className="kid-progress-track">
              <div className="kid-progress-fill" style={{ width: `${pct}%` }} />
              <div className="kid-progress-flag" style={{ left: `${pct}%` }}>🏁</div>
            </div>
            <div className="kid-progress-labels">
              <span>START</span>
              <span>FINISH</span>
            </div>
          </div>
        </div>
      </div>

      <div className="week-grid">
        <div className="week-grid-side">
          {CHORES.map((c) => (
            <div key={c.id} className="chore-row-label">
              <span className="chore-row-icon">{c.icon}</span>
              <span className="chore-row-text">{c.label}</span>
            </div>
          ))}
          <div className="chore-row-label total-row">
            <span className="chore-row-icon">⭐</span>
            <span className="chore-row-text">Daily total</span>
          </div>
        </div>
        <div className="week-grid-days">
          {DAYS.map((day) => (
            <DayColumn
              key={day}
              day={day}
              isToday={day === todayDay}
              kid={kid}
              dayState={kidState[day]}
              onToggle={(choreId, e) => onToggle(kid.id, day, choreId, e)}
              adminMode={adminMode}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ LEADERBOARD ============

function Leaderboard({ totals }) {
  const sorted = [...KIDS].sort((a, b) => totals[b.id] - totals[a.id]);
  const lead = totals[sorted[0].id];
  const trail = totals[sorted[1].id];
  const tied = lead === trail;

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <CheckerFlag width={120} height={12} />
        <div className="leaderboard-title">WEEKLY STANDINGS</div>
        <CheckerFlag width={120} height={12} />
      </div>
      <div className="leaderboard-rows">
        {sorted.map((kid, i) => {
          const isLead = !tied && i === 0;
          return (
            <div
              key={kid.id}
              className={`lb-row ${isLead ? "lead" : ""}`}
              style={{ "--kid-color": kid.color, "--kid-dark": kid.colorDark }}
            >
              <div className="lb-pos">{tied ? "=" : `${i + 1}`}</div>
              <PixelAvatar kind={kid.avatar} size={40} />
              <div className="lb-name">{kid.name}</div>
              <div className="lb-stars">
                <PixelStar size={20} lit />
                <span>{totals[kid.id]}</span>
              </div>
              {isLead && <div className="lb-crown">👑 LEADER</div>}
              {tied && i === 0 && <div className="lb-crown tied">🤝 TIED</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ MAIN APP ============

function App() {
  const [state, setState] = useState(loadState);
  const [adminMode, setAdminMode] = useState(true);
  const [bursts, setBursts] = useState([]);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinError, setPinError] = useState(false);

  // Derive "today" — use real day of week for fun
  const todayDay = useMemo(() => {
    const idx = (new Date().getDay() + 6) % 7; // Mon=0
    return DAYS[idx];
  }, []);

  useEffect(() => { saveState(state); }, [state]);

  const totals = useMemo(() => {
    const t = {};
    for (const kid of KIDS) {
      let n = 0;
      for (const day of DAYS) for (const c of CHORES) if (state[kid.id][day][c.id]) n++;
      t[kid.id] = n;
    }
    return t;
  }, [state]);

  function toggleChore(kidId, day, choreId, e) {
    const wasChecked = state[kidId][day][choreId];
    setState((prev) => ({
      ...prev,
      [kidId]: {
        ...prev[kidId],
        [day]: { ...prev[kidId][day], [choreId]: !wasChecked },
      },
    }));

    if (!wasChecked && e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const kid = KIDS.find((k) => k.id === kidId);
      const id = Date.now() + Math.random();
      setBursts((b) => [...b, { id, x: cx, y: cy, color: kid.color }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
      // Sound-ish feedback via vibration on mobile
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }

  function resetWeek() {
    if (!confirm("Start a fresh week? All stars will be cleared.")) return;
    const empty = {};
    for (const kid of KIDS) {
      empty[kid.id] = {};
      for (const day of DAYS) {
        empty[kid.id][day] = {};
        for (const c of CHORES) empty[kid.id][day][c.id] = false;
      }
    }
    setState(empty);
  }

  function tryAdminToggle() {
    if (adminMode) {
      setAdminMode(false);
    } else {
      setShowAdminGate(true);
      setAdminPin("");
      setPinError(false);
    }
  }

  function submitPin() {
    if (adminPin === "1234") {
      setAdminMode(true);
      setShowAdminGate(false);
    } else {
      setPinError(true);
      setAdminPin("");
    }
  }

  return (
    <div className="page">
      {/* Background pattern */}
      <div className="bg-pattern" />
      <div className="bg-clouds">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`cloud cloud-${i}`} />
        ))}
      </div>

      <header className="topbar">
        <div className="topbar-left">
          <div className="logo">
            <div className="logo-icon">
              <PixelStar size={36} lit />
            </div>
            <div className="logo-text">
              <div className="logo-title">STAR RACE</div>
              <div className="logo-sub">CHORE QUEST · WEEK OF MAY 2</div>
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="checker-bar"><CheckerFlag width={140} height={14} /></div>
          <button
            className={`mode-btn ${adminMode ? "on" : "off"}`}
            onClick={tryAdminToggle}
          >
            <span className="mode-dot" />
            {adminMode ? "ADMIN MODE" : "KID VIEW"}
          </button>
          {adminMode && (
            <button className="reset-btn" onClick={resetWeek}>
              ↻ NEW WEEK
            </button>
          )}
        </div>
      </header>

      <Leaderboard totals={totals} />

      <main className="lanes">
        {KIDS.map((kid) => (
          <KidLane
            key={kid.id}
            kid={kid}
            kidState={state[kid.id]}
            onToggle={toggleChore}
            adminMode={adminMode}
            todayDay={todayDay}
          />
        ))}
      </main>

      <footer className="bottom-bar">
        <div className="legend">
          <div className="legend-item">
            <div className="legend-swatch lit"><PixelStar size={18} lit /></div>
            <span>chore done — star earned</span>
          </div>
          <div className="legend-item">
            <div className="legend-swatch dim"><PixelStar size={18} lit={false} /></div>
            <span>not yet</span>
          </div>
          <div className="legend-item">
            <span style={{ fontSize: 18 }}>🏁</span>
            <span>full day complete</span>
          </div>
        </div>
        <div className="bottom-hint">
          {adminMode
            ? "Tap a chore square to award a star · stars tally automatically"
            : "Ask a grown-up to switch on Admin Mode to award stars"}
        </div>
      </footer>

      {/* Star burst overlay */}
      {bursts.map((b) => <StarBurst key={b.id} {...b} />)}

      {/* Admin pin gate */}
      {showAdminGate && (
        <div className="modal-backdrop" onClick={() => setShowAdminGate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">🔒 GROWN-UP ZONE</div>
            <div className="modal-sub">Enter the secret code to award stars</div>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={adminPin}
              onChange={(e) => { setAdminPin(e.target.value); setPinError(false); }}
              onKeyDown={(e) => e.key === "Enter" && submitPin()}
              className={`pin-input ${pinError ? "err" : ""}`}
              placeholder="••••"
            />
            {pinError && <div className="pin-error">Nope! Try again.</div>}
            <div className="modal-hint">(hint: try 1234)</div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowAdminGate(false)}>Cancel</button>
              <button className="modal-submit" onClick={submitPin}>Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
