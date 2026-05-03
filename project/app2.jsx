/* global React */
const { useState, useEffect, useMemo } = React;

const CHORES = [
  { id: "teeth", label: "Brush teeth / wash face", icon: "🪥", points: 1 },
  { id: "exercise", label: "Exercise", icon: "💪", points: 1 },
  { id: "listen", label: "Listen the first time", icon: "👂", points: 2 },
  { id: "brother", label: "Be a good brother", icon: "🤝", points: 1 },
  { id: "plates", label: "Put plates away", icon: "🍽", points: 1 },
  { id: "room", label: "Clean room / toys away", icon: "🧸", points: 1 },
  { id: "outside", label: "Stuff away after coming in", icon: "🎒", points: 1 },
];
const KIDS = [
  { id: "raffi", name: "RAFFI", num: "01", color: "#FF1A30", colorDark: "#7A0512", accent: "#FFD23F", car: "Stallion GT" },
  { id: "tigran", name: "TIGRAN", num: "02", color: "#2EC4B6", colorDark: "#063532", accent: "#9BF6FF", car: "Aerion V12" },
];
const MONTHLY_GOAL = 100;
const MAX_DAILY = CHORES.reduce((s, c) => s + c.points, 0); // 8

// Build month days (May 2026 — 31 days, starts Friday)
function buildMonth() {
  const year = 2026, month = 4; // May = index 4
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (first.getDay() + 6) % 7; // Mon=0
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, daysInMonth, year, month, startDow };
}
const MONTH = buildMonth();
const MONTH_NAME = "MAY 2026";
const TODAY_DAY = 2; // May 2

const STORAGE_KEY = "kidcal:v4";
function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  const empty = { stars: {} };
  for (const k of KIDS) {
    empty.stars[k.id] = {};
    for (let d = 1; d <= MONTH.daysInMonth; d++) {
      empty.stars[k.id][d] = {};
      for (const c of CHORES) empty.stars[k.id][d][c.id] = false;
    }
  }
  return empty;
}
function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {} }

let audioCtx;
function getCtx() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return audioCtx; }
// Reusable noise buffer (pink-ish) for engine layers
let _engineNoiseBuf;
function getEngineNoiseBuf(ctx) {
  if (_engineNoiseBuf) return _engineNoiseBuf;
  const len = ctx.sampleRate * 1.0;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Pink noise (Voss-McCartney-ish, simple)
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460;
    b1 = 0.96300 * b1 + w * 0.2965164;
    b2 = 0.57000 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
  }
  _engineNoiseBuf = buf;
  return buf;
}

// ============================================================
// ENGINE SIMULATOR — Forza/NFS-style continuous engine
// Approach: synthesize ONE single-cylinder firing pulse into a buffer.
// Loop it via BufferSource at variable playbackRate => the RPM.
// Multiple staggered voices = V8 firing-order beat.
// RPM ramps up on each tap and decays back to idle.
// ============================================================

let _enginePulseBuf;
function getEnginePulseBuf(ctx) {
  if (_enginePulseBuf) return _enginePulseBuf;
  const baseLen = 0.060; // idle firing interval
  const sr = ctx.sampleRate;
  const len = Math.floor(baseLen * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  // Damped sinusoidal modes = engine bay / exhaust resonances
  const modes = [
    { f: 60,  decay: 0.040, amp: 1.00 },
    { f: 95,  decay: 0.035, amp: 0.55 },
    { f: 140, decay: 0.030, amp: 0.40 },
    { f: 220, decay: 0.020, amp: 0.30 },
    { f: 380, decay: 0.012, amp: 0.18 },
    { f: 600, decay: 0.008, amp: 0.10 },
  ];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    for (const m of modes) s += m.amp * Math.sin(2 * Math.PI * m.f * t) * Math.exp(-t / m.decay);
    if (t < 0.006) s += (Math.random() * 2 - 1) * 0.7 * (1 - t / 0.006); // combustion crack
    s += (Math.random() * 2 - 1) * 0.12 * Math.exp(-t / 0.020); // exhaust puff
    d[i] = s;
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
  _enginePulseBuf = buf;
  return buf;
}

const engine = {
  started: false,
  rpm: 1.0,
  targetRpm: 1.0,
  voices: [],
  master: null, lp: null, peak: null, hs: null, shaper: null,
  rafId: null, lastTime: 0,
  shutoffTimer: null,
};

function stopEngine() {
  const ctx = getCtx(); if (!ctx || !engine.started) return;
  // Stop the tick loop FIRST so it can't override our fade-out
  if (engine.rafId) cancelAnimationFrame(engine.rafId);
  engine.rafId = null;
  const t = ctx.currentTime;
  const master = engine.master;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(0.0001, t + 0.18);
  const voices = engine.voices;
  setTimeout(() => {
    voices.forEach((v) => { try { v.src.stop(); } catch (e) {} });
    try { master.disconnect(); } catch (e) {}
  }, 220);
  engine.started = false;
  engine.voices = [];
  if (engine.shutoffTimer) { clearTimeout(engine.shutoffTimer); engine.shutoffTimer = null; }
}

function scheduleEngineShutoff() {
  if (engine.shutoffTimer) clearTimeout(engine.shutoffTimer);
  // 1.5s after last blip => kill engine (fade is 0.18s, scheduled inside)
  engine.shutoffTimer = setTimeout(() => stopEngine(), 1320);
}

function startEngine() {
  const ctx = getCtx(); if (!ctx) return;
  if (engine.started) return;
  if (ctx.state === "suspended") ctx.resume();
  const buf = getEnginePulseBuf(ctx);

  const master = ctx.createGain(); master.gain.value = 0;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) { const x = (i/2048)*2-1; curve[i] = Math.tanh(x*1.6); }
  shaper.curve = curve; shaper.oversample = "4x";

  const peak = ctx.createBiquadFilter();
  peak.type = "peaking"; peak.frequency.value = 180; peak.Q.value = 1.8; peak.gain.value = 6;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.Q.value = 1.2; lp.frequency.value = 700;

  const hs = ctx.createBiquadFilter();
  hs.type = "highshelf"; hs.frequency.value = 1500; hs.gain.value = -6;

  peak.connect(lp).connect(hs).connect(shaper).connect(master).connect(ctx.destination);

  // 4 staggered voices = V8 firing-order beat
  const NUM = 4;
  const voices = [];
  for (let i = 0; i < NUM; i++) {
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.playbackRate.value = 1.0;
    src.detune.value = (i - 1.5) * 6;
    const g = ctx.createGain(); g.gain.value = 0.32;
    src.connect(g).connect(peak);
    src.start(ctx.currentTime + (i / NUM) * 0.060);
    voices.push({ src, gain: g });
  }

  engine.started = true;
  engine.master = master; engine.lp = lp; engine.peak = peak; engine.hs = hs; engine.shaper = shaper;
  engine.voices = voices;
  engine.rpm = 1.0; engine.targetRpm = 1.0;
  engine.lastTime = performance.now();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.05);

  function tick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - engine.lastTime) / 1000);
    engine.lastTime = now;
    const rate = engine.targetRpm > engine.rpm ? 5.5 : 1.6;
    engine.rpm += (engine.targetRpm - engine.rpm) * Math.min(1, dt * rate);
    engine.targetRpm += (1.0 - engine.targetRpm) * Math.min(1, dt * 0.9);
    const t = ctx.currentTime;
    for (const v of engine.voices) v.src.playbackRate.setTargetAtTime(engine.rpm, t, 0.02);
    engine.lp.frequency.setTargetAtTime(500 + Math.pow(engine.rpm, 1.4) * 1700, t, 0.04);
    engine.hs.gain.setTargetAtTime(-8 + Math.min(10, (engine.rpm - 1) * 5), t, 0.05);
    engine.master.gain.setTargetAtTime(0.16 + Math.min(0.10, (engine.rpm - 1) * 0.06), t, 0.05);
    engine.rafId = requestAnimationFrame(tick);
  }
  engine.rafId = requestAnimationFrame(tick);
}

function blipEngine(strength = 1.0) {
  const ctx = getCtx(); if (!ctx) return;
  if (!engine.started) startEngine();
  engine.targetRpm = Math.max(engine.targetRpm, 2.4 + strength * 1.4);
  scheduleEngineShutoff();
  // Exhaust crack on top
  const buf = getEngineNoiseBuf(ctx);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.playbackRate.value = 0.9 + Math.random() * 0.3;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 1100 + Math.random() * 400; bp.Q.value = 2.5;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22 * strength, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t); src.stop(t + 0.13);
}

// ============================================================
// CLICK SOUND — preloaded WAV, plays via Web Audio for low latency.
// Capped at 1.5s; overlapping taps stop the previous instance.
// ============================================================
let _clickBuf = null;
let _clickBufLoading = false;
let _activeClickSrc = null;
function preloadClickSound() {
  if (_clickBuf || _clickBufLoading) return;
  const ctx = getCtx(); if (!ctx) return;
  _clickBufLoading = true;
  fetch("drive-by.wav")
    .then((r) => r.arrayBuffer())
    .then((ab) => ctx.decodeAudioData(ab))
    .then((buf) => { _clickBuf = buf; })
    .catch(() => {})
    .finally(() => { _clickBufLoading = false; });
}
function playWoosh() {
  const ctx = getCtx(); if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  if (!_clickBuf) {
    // First-tap path: kick off preload and play once it lands
    preloadClickSound();
    const start = Date.now();
    const wait = setInterval(() => {
      if (_clickBuf) { clearInterval(wait); _playClickBuf(); }
      else if (Date.now() - start > 2000) clearInterval(wait);
    }, 30);
    return;
  }
  _playClickBuf();
}
function _playClickBuf() {
  const ctx = getCtx(); if (!ctx || !_clickBuf) return;
  if (_activeClickSrc) { try { _activeClickSrc.stop(); } catch (e) {} _activeClickSrc = null; }
  const src = ctx.createBufferSource();
  src.buffer = _clickBuf;
  const g = ctx.createGain();
  g.gain.value = 0.85;
  const t = ctx.currentTime;
  const capDur = Math.min(1.5, _clickBuf.duration);
  g.gain.setValueAtTime(0.85, t + Math.max(0, capDur - 0.15));
  g.gain.linearRampToValueAtTime(0.0001, t + capDur);
  src.connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + capDur + 0.02);
  _activeClickSrc = src;
  src.onended = () => { if (_activeClickSrc === src) _activeClickSrc = null; };
}
function playRev() {
  const ctx = getCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter();
  osc.type = "sawtooth"; osc.frequency.setValueAtTime(70, now); osc.frequency.linearRampToValueAtTime(220, now + 0.25); osc.frequency.linearRampToValueAtTime(140, now + 0.65);
  filter.type = "lowpass"; filter.frequency.setValueAtTime(900, now); filter.Q.value = 6;
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.13, now + 0.05); gain.gain.linearRampToValueAtTime(0.09, now + 0.4); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
  osc.connect(filter).connect(gain).connect(ctx.destination); osc.start(now); osc.stop(now + 0.8);
}

// Override carStage for new max (100 goal)
function carStageMonthly(pts) {
  if (pts >= 70) return 2;
  if (pts >= 35) return 1;
  return 0;
}

function pointsForDay(state, kidId, day) {
  let p = 0;
  for (const c of CHORES) if (state.stars[kidId][day]?.[c.id]) p += c.points;
  return p;
}
function totalPoints(state, kidId) {
  let p = 0;
  for (let d = 1; d <= MONTH.daysInMonth; d++) p += pointsForDay(state, kidId, d);
  return p;
}
function fullDays(state, kidId) {
  let n = 0;
  for (let d = 1; d <= MONTH.daysInMonth; d++) if (pointsForDay(state, kidId, d) === MAX_DAILY) n++;
  return n;
}

function StarBurst({ x, y, color, big, emoji }) {
  return (
    <div className="burst" style={{ left: x, top: y, "--c": color }}>
      <div className="burst-ring" />
      <div className="burst-star"><ChromeStar size={big ? 72 : 56} lit glint /></div>
      {emoji && <div className="burst-emoji">{emoji}</div>}
      <div className="burst-plus" style={{ color }}>+{big ? 2 : 1}</div>
    </div>
  );
}

function DayCell({ kid, day, state, onPickDay, onOpenPopover, isToday, isSelected, isPopoverOpen, adminMode }) {
  if (day == null) return <div className="cal-cell empty" />;
  const pts = pointsForDay(state, kid.id, day);
  const full = pts === MAX_DAILY;
  const some = pts > 0;
  const pct = pts / MAX_DAILY;
  return (
    <button
      className={`cal-cell ${full ? "full" : some ? "some" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${isPopoverOpen ? "popover-open" : ""}`}
      data-cell={`${kid.id}-${day}`}
      onClick={(e) => {
        onPickDay(day);
        if (adminMode) onOpenPopover(day, e.currentTarget);
      }}
      style={{ "--kc": kid.color }}
    >
      <div className="cal-cell-num">{day}</div>
      {pts > 0 && (
        <div className="cal-cell-pts">
          <ChromeStar size={11} lit /> <span>{pts}</span>
        </div>
      )}
      {full && <div className="cal-cell-flag">🏁</div>}
      {!full && some && (
        <div className="cal-cell-bar">
          <div className="cal-cell-fill" style={{ width: `${pct * 100}%` }} />
        </div>
      )}
      {isToday && <div className="cal-cell-now">LIVE</div>}
    </button>
  );
}

function QuickChorePopover({ kid, day, anchorRect, state, onToggle, onAddAll, onClearDay, onClose }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(() => computePos(anchorRect));

  function computePos(rect) {
    if (!rect) return { left: window.innerWidth / 2 - 170, top: 80, placement: "below", arrowLeft: 170 };
    const W = 340;
    const H = Math.min(460, window.innerHeight - 24);
    const margin = 12;
    const cellCenterX = rect.left + rect.width / 2;
    let left = cellCenterX - W / 2;
    left = Math.max(margin, Math.min(window.innerWidth - W - margin, left));
    let placement = "below";
    let top = rect.bottom + 10;
    const spaceBelow = window.innerHeight - top - margin;
    const spaceAbove = rect.top - margin - 10;
    if (spaceBelow < H && spaceAbove > spaceBelow) {
      placement = "above";
      top = Math.max(margin, rect.top - 10 - H);
    }
    const arrowLeft = Math.max(20, Math.min(W - 20, cellCenterX - left));
    return { left, top, placement, arrowLeft, height: H };
  }

  React.useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onEsc(e) { if (e.key === "Escape") onClose(); }
    function onResize() { setPos(computePos(anchorRect)); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [onClose, anchorRect]);

  const dayPts = pointsForDay(state, kid.id, day);

  return ReactDOM.createPortal(
    <>
      <div className="quick-pop-backdrop" onClick={onClose} />
      <div
        className={`quick-pop quick-pop-${pos.placement}`}
        ref={ref}
        style={{ left: pos.left, top: pos.top, maxHeight: pos.height, "--arrow-left": `${pos.arrowLeft}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quick-pop-arrow" />
        <div className="quick-pop-head">
          <div>
            <div className="quick-pop-tag">DAY {day}</div>
            <div className="quick-pop-name" style={{ color: kid.color }}>{kid.name}</div>
          </div>
          <div className="quick-pop-score"><ChromeStar size={16} lit /> {dayPts}/{MAX_DAILY}</div>
        </div>
        <div className="quick-pop-scroll">
          <div className="quick-pop-grid">
            {CHORES.map((c) => {
              const checked = state.stars[kid.id][day]?.[c.id];
              return (
                <button
                  key={c.id}
                  className={`quick-chip ${checked ? "on" : ""} ${c.points === 2 ? "double" : ""}`}
                  onClick={(e) => onToggle(kid.id, day, c.id, c.points, e)}
                  title={c.label}
                >
                  <span className="quick-chip-icon">{c.icon}</span>
                  <span className="quick-chip-label">{c.label}</span>
                  {c.points === 2 && <span className="quick-chip-2x">2×</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="quick-pop-actions">
          <button className="quick-act add" onClick={onAddAll}>★ ADD ALL</button>
          <button className="quick-act clear" onClick={onClearDay}>↻ CLEAR DAY</button>
          <button className="quick-act close" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </>,
    document.body
  );
}

function KidLane({ kid, state, onToggle, onAddAllDay, onClearDay, adminMode, selectedDay, setSelectedDay, popover, openPopover, closePopover }) {
  const total = useMemo(() => totalPoints(state, kid.id), [state, kid.id]);
  const pct = Math.min(100, (total / MONTHLY_GOAL) * 100);
  const stage = carStageMonthly(total);
  const stageLabel = ["STOCK", "TUNED", "MAXED"][stage];
  const fdays = fullDays(state, kid.id);
  const Car = kid.id === "raffi" ? RaffiCar : TigranCar;
  const dayPts = pointsForDay(state, kid.id, selectedDay);

  return (
    <section className="lane" style={{ "--kc": kid.color, "--kd": kid.colorDark, "--ka": kid.accent }}>
      <div className="lane-banner">
        <div className="lane-banner-bg" />
        <div className="lane-driver">
          <div className="driver-num">#{kid.num}</div>
          <HelmetAvatar kid={kid.id} size={64} />
          <div className="driver-info">
            <div className="driver-tag">DRIVER · {kid.car}</div>
            <div className="driver-name">{kid.name}</div>
            <div className="driver-stats">
              <span className="stat-pill"><ChromeStar size={14} lit /> {total}<span className="stat-unit">/{MONTHLY_GOAL}</span></span>
              <span className="stat-pill">🏁 {fdays}<span className="stat-unit">/{MONTH.daysInMonth}</span></span>
              <span className={`stat-pill stat-stage stage-${stage}`}>{stageLabel}</span>
              <span className={`stat-pill stat-goal ${total >= MONTHLY_GOAL ? "achieved" : ""}`}>
                🎯 {total >= MONTHLY_GOAL ? "GOAL ✓" : `${MONTHLY_GOAL - total} TO 100`}
              </span>
            </div>
          </div>
        </div>
        <div className="lane-car">
          <Car stars={total} width={400} />
        </div>
      </div>

      {/* Track strip — month-long */}
      <div className="lane-track">
        <div className="track-tape">
          <div className="track-tape-line" />
          <div className="track-tape-finish" />
          <div className="track-pos" style={{ left: `calc(${pct}% - 24px)` }}>
            <div className="track-pos-car">
              <img
                src={kid.id === "raffi" ? "assets/raffi-car.png" : "assets/tigran-car.png"}
                alt=""
                draggable={false}
                style={{
                  width: 48, height: 48, objectFit: "cover",
                  borderRadius: "50%",
                  border: `2px solid ${kid.color}`,
                  boxShadow: `0 0 0 2px rgba(0,0,0,0.5), 0 4px 12px ${kid.color}99`,
                  background: "#000",
                }}
              />
            </div>
            <div className="track-pos-label">{Math.round(pct)}%</div>
          </div>
        </div>
        <div className="track-meta">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>FINISH · 100</span>
        </div>
      </div>

      {/* Two-pane: month calendar + chore checklist for selected day */}
      <div className="lane-month">
        <div className="cal-pane">
          <div className="cal-head">
            {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d => <div key={d} className="cal-dow">{d}</div>)}
          </div>
          <div className="cal-grid">
            {MONTH.cells.map((d, i) => {
              const isPop = popover && popover.kidId === kid.id && popover.day === d;
              return (
                <div key={i} className="cal-cell-wrap">
                  <DayCell
                    kid={kid}
                    day={d}
                    state={state}
                    onPickDay={setSelectedDay}
                    onOpenPopover={(day, el) => openPopover(kid.id, day, el.getBoundingClientRect())}
                    isToday={d === TODAY_DAY}
                    isSelected={d === selectedDay}
                    isPopoverOpen={isPop}
                    adminMode={adminMode}
                  />
                  {isPop && (
                    <QuickChorePopover
                      kid={kid}
                      day={d}
                      anchorRect={popover.rect}
                      state={state}
                      onToggle={onToggle}
                      onAddAll={() => onAddAllDay(kid.id, d)}
                      onClearDay={() => onClearDay(kid.id, d)}
                      onClose={closePopover}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="chore-pane">
          <div className="chore-pane-head">
            <div>
              <div className="chore-pane-tag">SELECTED · DAY {selectedDay}</div>
              <div className="chore-pane-title">{adminMode ? "TAP ANY DAY ABOVE" : "DRIVER VIEW"}</div>
            </div>
            <div className="chore-pane-score">
              <ChromeStar size={20} lit /> {dayPts}<span className="stat-unit">/{MAX_DAILY}</span>
            </div>
          </div>
          <div className="chore-pane-hint">
            {adminMode
              ? "Tap any calendar day to open its chore picker. Use ADD ALL or CLEAR DAY for quick edits."
              : "Switch to Pit Crew (with code) to award chores."}
          </div>
        </div>
      </div>
    </section>
  );
}

function Standings({ state }) {
  const totals = {};
  for (const k of KIDS) totals[k.id] = totalPoints(state, k.id);
  const sorted = [...KIDS].sort((a, b) => totals[b.id] - totals[a.id]);
  const tied = totals[sorted[0].id] === totals[sorted[1].id];
  return (
    <div className="standings">
      <div className="standings-header">
        <Checker width={120} height={10} />
        <div className="standings-title">▸ {MONTH_NAME} CHAMPIONSHIP</div>
        <Checker width={120} height={10} />
      </div>
      <div className="standings-rows">
        {sorted.map((kid, i) => {
          const isLead = !tied && i === 0;
          return (
            <div key={kid.id} className={`stand-row ${isLead ? "lead" : ""}`}
              style={{ "--kc": kid.color, "--kd": kid.colorDark }}>
              <div className="stand-pos">{tied ? "=" : `P${i + 1}`}</div>
              <HelmetAvatar kid={kid.id} size={42} />
              <div className="stand-name-block">
                <div className="stand-name">{kid.name}</div>
                <div className="stand-car">{kid.car}</div>
              </div>
              <div className="stand-stat"><ChromeStar size={16} lit /> <b>{totals[kid.id]}</b><span className="stat-unit">/100</span></div>
              <div className="stand-stat">🏁 <b>{fullDays(state, kid.id)}</b></div>
              {isLead && <div className="stand-crown">👑 LEADER</div>}
              {tied && i === 0 && <div className="stand-crown tied">⚡ TIED</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState(loadState);
  const [adminMode, setAdminMode] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [bursts, setBursts] = useState([]);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [selectedDay, setSelectedDay] = useState(TODAY_DAY);
  const [popover, setPopover] = useState(null); // {kidId, day, rect}
  function openPopover(kidId, day, rect) { setPopover({ kidId, day, rect }); }
  function closePopover() { setPopover(null); }

  useEffect(() => { saveState(state); }, [state]);

  function addBurst(x, y, color, big, emoji) {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, x, y, color, big, emoji }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
  }

  function toggle(kidId, day, choreId, points, e) {
    if (!adminMode) return;
    const wasChecked = state.stars[kidId][day][choreId];
    setState((prev) => ({
      ...prev,
      stars: {
        ...prev.stars,
        [kidId]: { ...prev.stars[kidId], [day]: { ...prev.stars[kidId][day], [choreId]: !wasChecked } },
      },
    }));
    if (!wasChecked && e) {
      const r = e.currentTarget.getBoundingClientRect();
      const k = KIDS.find((x) => x.id === kidId);
      const chore = CHORES.find((c) => c.id === choreId);
      addBurst(r.left + r.width / 2, r.top + r.height / 2, k.color, points === 2, chore?.icon);
      if (soundOn) {
        playWoosh();
        const newTotal = totalPoints(state, kidId) + points;
        if (newTotal >= MONTHLY_GOAL && totalPoints(state, kidId) < MONTHLY_GOAL) setTimeout(playRev, 200);
      }
    }
  }

  function addAllDay(kidId, day) {
    if (!adminMode) return;
    setState((prev) => {
      const dayMap = { ...prev.stars[kidId][day] };
      for (const c of CHORES) dayMap[c.id] = true;
      return { ...prev, stars: { ...prev.stars, [kidId]: { ...prev.stars[kidId], [day]: dayMap } } };
    });
    // celebratory burst stack
    const k = KIDS.find((x) => x.id === kidId);
    const cellEl = document.querySelector(`[data-cell="${kidId}-${day}"]`);
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    if (cellEl) {
      const r = cellEl.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    }
    CHORES.forEach((c, i) => {
      setTimeout(() => addBurst(cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 30, k.color, c.points === 2, c.icon), i * 70);
    });
    if (soundOn) { playWoosh(); setTimeout(playRev, 200); }
  }

  function clearDay(kidId, day) {
    if (!adminMode) return;
    setState((prev) => {
      const dayMap = {};
      for (const c of CHORES) dayMap[c.id] = false;
      return { ...prev, stars: { ...prev.stars, [kidId]: { ...prev.stars[kidId], [day]: dayMap } } };
    });
  }

  function tryAdmin() {
    if (adminMode) setAdminMode(false);
    else { setShowPin(true); setPin(""); setPinErr(false); }
  }
  function submitPin() {
    if (pin === "0702") { setAdminMode(true); setShowPin(false); }
    else { setPinErr(true); setPin(""); }
  }
  function resetMonth() {
    if (!confirm("Clear ALL stars for this month? Both kids, every day.")) return;
    const empty = { stars: {} };
    for (const k of KIDS) {
      empty.stars[k.id] = {};
      for (let d = 1; d <= MONTH.daysInMonth; d++) {
        empty.stars[k.id][d] = {};
        for (const c of CHORES) empty.stars[k.id][d][c.id] = false;
      }
    }
    setState(empty);
  }

  return (
    <div className="page">
      <SunsetBg />
      <div className="page-haze" />
      <div className="page-grid" />

      <div className="page-content">
        <header className="topbar">
          <div className="topbar-brand">
            <div className="brand-mark"><ChromeStar size={42} lit /></div>
            <div className="brand-text">
              <div className="brand-title">SUNSET CIRCUIT</div>
              <div className="brand-sub">CHORE GRAND PRIX · {MONTH_NAME} · GOAL 100</div>
            </div>
          </div>
          <div className="topbar-controls">
            <button className={`tb-btn ${soundOn ? "on" : ""}`} onClick={() => setSoundOn((s) => !s)}>
              {soundOn ? "🔊 SOUND" : "🔇 MUTED"}
            </button>
            <button className={`tb-btn ${adminMode ? "admin-on" : ""}`} onClick={tryAdmin}>
              <span className={`tb-dot ${adminMode ? "live" : ""}`} />
              {adminMode ? "PIT CREW" : "DRIVER VIEW"}
            </button>
            {adminMode && <button className="tb-btn warn" onClick={resetMonth}>↻ CLEAR ALL STARS</button>}
          </div>
        </header>

        <Standings state={state} />

        <main className="lanes">
          {KIDS.map((kid) => (
            <KidLane
              key={kid.id}
              kid={kid}
              state={state}
              onToggle={toggle}
              onAddAllDay={addAllDay}
              onClearDay={clearDay}
              adminMode={adminMode}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              popover={popover}
              openPopover={openPopover}
              closePopover={closePopover}
            />
          ))}
        </main>

        <footer className="footer">
          <div className="footer-legend">
            <span className="leg-item"><ChromeStar size={18} lit /> 1 PT · CHORE</span>
            <span className="leg-item">⚡ 2 PTS · LISTEN FIRST TIME</span>
            <span className="leg-item">🏁 PERFECT DAY · 8 PTS</span>
            <span className="leg-item">🎯 MONTHLY GOAL · 100 PTS</span>
          </div>
          <div className="footer-hint">
            {adminMode ? "Tap a day on the calendar, then tap chores to award points" : "Switch to Pit Crew to award points"}
          </div>
        </footer>
      </div>

      {bursts.map((b) => <StarBurst key={b.id} {...b} />)}

      {showPin && (
        <div className="modal-bg" onClick={() => setShowPin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">🔒 PIT CREW ACCESS</div>
            <div className="modal-sub">Enter 4-digit code to award points</div>
            <input
              autoFocus type="password" inputMode="numeric" maxLength={4}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setPinErr(false); }}
              onKeyDown={(e) => e.key === "Enter" && submitPin()}
              className={`modal-input ${pinErr ? "err" : ""}`}
              placeholder="••••"
            />
            {pinErr && <div className="modal-err">Wrong code</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowPin(false)}>Cancel</button>
              <button className="modal-go" onClick={submitPin}>Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Kick off audio preload on first user gesture (autoplay policy)
window.addEventListener("pointerdown", function _firstTap() {
  window.removeEventListener("pointerdown", _firstTap);
  try { preloadClickSound(); } catch (e) {}
}, { once: true });

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
