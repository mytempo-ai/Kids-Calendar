/* global React */
// Photo-based hero cars. Three upgrade tiers add aero/livery overlays.

function carStage(stars) {
  if (stars >= 70) return 2;
  if (stars >= 35) return 1;
  return 0;
}

function HeroCar({ src, width = 400, accent, stars = 0 }) {
  const stage = carStage(stars);
  const stageLabel = ["STOCK", "TUNED", "MAXED"][stage];
  return (
    <div
      style={{
        position: "relative",
        width: width,
        aspectRatio: "1 / 1",
        borderRadius: "22px",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.08), transparent 65%), linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.7))",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <img
        src={src}
        alt="race car"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter:
            stage === 0
              ? "saturate(0.92) brightness(0.96)"
              : stage === 1
              ? "saturate(1.1) brightness(1.02) contrast(1.04)"
              : "saturate(1.2) brightness(1.05) contrast(1.08)",
        }}
        draggable={false}
      />
      {/* Stage 1+: vignette & accent rim light */}
      {stage >= 1 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 80% 30%, ${accent}40, transparent 55%), radial-gradient(circle at 20% 90%, rgba(0,0,0,0.6), transparent 55%)`,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Stage 2: glowing edge frame */}
      {stage === 2 && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: `2px solid ${accent}`,
              borderRadius: "22px",
              boxShadow: `inset 0 0 32px ${accent}55, 0 0 32px ${accent}66`,
              pointerEvents: "none",
              animation: "maxedShine 2s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              fontFamily: "'Russo One', sans-serif",
              fontSize: 11,
              letterSpacing: "0.18em",
              padding: "4px 10px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FFD23F, #FF1A30)",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(255,210,63,0.4)",
            }}
          >
            ⚡ MAXED
          </div>
        </>
      )}
      {stage < 2 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            fontFamily: "'Russo One', sans-serif",
            fontSize: 10,
            letterSpacing: "0.18em",
            padding: "4px 9px",
            borderRadius: 999,
            background:
              stage === 1
                ? "linear-gradient(135deg, #FFD23F, #FF8855)"
                : "rgba(0,0,0,0.55)",
            color: stage === 1 ? "#08040E" : "rgba(255,255,255,0.85)",
            border:
              stage === 1
                ? "none"
                : "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {stageLabel}
        </div>
      )}
    </div>
  );
}

function RaffiCar({ stars = 0, width = 360 }) {
  return <HeroCar src="assets/raffi-car.png" width={width} accent="#FF1A30" stars={stars} />;
}
function TigranCar({ stars = 0, width = 360 }) {
  return <HeroCar src="assets/tigran-car.png" width={width} accent="#2EC4B6" stars={stars} />;
}


// 3D chrome-gold star
function ChromeStar({ size = 32, lit = true, glint = false }) {
  if (!lit) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <polygon
          points="50,12 61,40 92,42 67,62 76,92 50,75 24,92 33,62 8,42 39,40"
          fill="#1a1620"
          stroke="#0a0610"
          strokeWidth="1.5"
          opacity="0.6"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`star-grad-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFAD0" />
          <stop offset="35%" stopColor="#FFD23F" />
          <stop offset="75%" stopColor="#D88800" />
          <stop offset="100%" stopColor="#7A4A00" />
        </linearGradient>
      </defs>
      {glint && (
        <circle cx="50" cy="50" r="48" fill="#FFD23F" opacity="0.3">
          <animate attributeName="r" values="40;55;40" dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
      <polygon
        points="50,16 61,42 90,44 67,62 76,90 50,75 24,90 33,62 10,44 39,42"
        fill="#000"
        opacity="0.4"
        transform="translate(2,3)"
      />
      <polygon
        points="50,12 61,40 92,42 67,62 76,92 50,75 24,92 33,62 8,42 39,40"
        fill={`url(#star-grad-${size})`}
        stroke="#5A3500"
        strokeWidth="1.2"
      />
      <polygon
        points="50,12 61,40 50,50 39,40"
        fill="#fff"
        opacity="0.5"
      />
      <polygon
        points="50,50 39,40 8,42 33,62"
        fill="#000"
        opacity="0.15"
      />
      <polygon
        points="50,50 67,62 76,92 50,75"
        fill="#000"
        opacity="0.22"
      />
      <ellipse cx="42" cy="32" rx="6" ry="3" fill="#fff" opacity="0.55" />
    </svg>
  );
}

// Driver helmet — refined
function HelmetAvatar({ kid, size = 56 }) {
  const isRaffi = kid === "raffi";
  const base = isRaffi ? "#E63946" : "#2EC4B6";
  const dark = isRaffi ? "#5A0A14" : "#063532";
  const stripe = isRaffi ? "#FFD23F" : "#9BF6FF";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id={`helm-${kid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={base} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="92" rx="24" ry="3" fill="#000" opacity="0.4" />
      <path d="M 22 50 Q 22 22 50 18 Q 78 22 78 50 L 78 72 Q 78 80 70 82 L 30 82 Q 22 80 22 72 Z"
        fill={`url(#helm-${kid})`} stroke={dark} strokeWidth="1.5" />
      <path d="M 26 42 Q 30 38 50 38 Q 70 38 74 42 L 74 60 Q 70 64 50 64 Q 30 64 26 60 Z"
        fill="#0a1020" stroke={dark} strokeWidth="1.5" />
      <path d="M 32 44 Q 38 42 50 42 L 60 42" stroke={stripe} strokeWidth="1.5" fill="none" opacity="0.7" />
      <rect x="48" y="18" width="4" height="22" fill={stripe} />
      <rect x="48" y="64" width="4" height="18" fill={stripe} />
      <ellipse cx="38" cy="32" rx="6" ry="10" fill="#fff" opacity="0.3" />
    </svg>
  );
}

function Checker({ width = 80, height = 14 }) {
  const cells = 16;
  const cellW = width / cells;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {Array.from({ length: cells * 2 }).map((_, i) => {
        const row = Math.floor(i / cells);
        const col = i % cells;
        const black = (row + col) % 2 === 0;
        return (
          <rect
            key={i}
            x={col * cellW}
            y={row * (height / 2)}
            width={cellW}
            height={height / 2}
            fill={black ? "#0a0610" : "#fff"}
          />
        );
      })}
    </svg>
  );
}

// Sunset background — more cinematic
function SunsetBg() {
  return (
    <svg
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }}
    >
      <defs>
        <linearGradient id="sky-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#180A30" />
          <stop offset="22%" stopColor="#3A1450" />
          <stop offset="48%" stopColor="#8A2C70" />
          <stop offset="68%" stopColor="#D14A6A" />
          <stop offset="82%" stopColor="#FF7F4F" />
          <stop offset="100%" stopColor="#FFB060" />
        </linearGradient>
        <radialGradient id="sun-bg" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFFAD0" />
          <stop offset="40%" stopColor="#FFB04F" />
          <stop offset="100%" stopColor="#FF6035" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="600" fill="url(#sky-bg)" />
      {/* atmosphere haze */}
      <rect y="380" width="1000" height="60" fill="#FF7F4F" opacity="0.25" />
      {/* sun */}
      <circle cx="500" cy="400" r="280" fill="#FFAE3F" opacity="0.08" />
      <circle cx="500" cy="400" r="180" fill="#FFAE3F" opacity="0.15" />
      <circle cx="500" cy="400" r="100" fill="url(#sun-bg)" opacity="0.95" />
      {/* mountains — distant */}
      <path d="M 0 440 L 120 380 L 220 420 L 360 360 L 480 410 L 600 370 L 740 415 L 880 380 L 1000 420 L 1000 600 L 0 600 Z"
        fill="#2A0E40" opacity="0.6" />
      <path d="M 0 470 L 100 430 L 240 460 L 400 420 L 560 460 L 720 425 L 880 455 L 1000 440 L 1000 600 L 0 600 Z"
        fill="#160620" opacity="0.85" />
      {/* heat ripples on horizon */}
      <ellipse cx="500" cy="495" rx="200" ry="8" fill="#FFD23F" opacity="0.35" />
      <ellipse cx="500" cy="510" rx="280" ry="6" fill="#FF8855" opacity="0.25" />
      <ellipse cx="500" cy="525" rx="380" ry="4" fill="#FFAE3F" opacity="0.18" />
    </svg>
  );
}

Object.assign(window, {
  RaffiCar, TigranCar, ChromeStar, HelmetAvatar, Checker, SunsetBg, carStage,
});
