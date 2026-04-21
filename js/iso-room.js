// Training Room — isometric hub scene the player returns to after a match.
// Renders a tiled floor with furniture and NPC objects placed at grid
// positions. Clickable objects carry a data-action consumed by main.js.
//
// Drag-to-pan is handled by putting the scene in an overflow:auto wrapper
// and adjusting scrollLeft/scrollTop on pointer drag. Pointer events on
// floor tiles are disabled so drag is always smooth; only .room-obj
// elements receive clicks. A small movement threshold distinguishes a
// pan from a tap so the user can click objects without accidentally
// panning them.

const ROOM = {
  cols: 12,
  rows: 10,
  tileW: 92,
  tileH: 46,
};

// Layout of the dummy room. Positions are grid coordinates.
// Replace `render` with a sprite <img> when real art arrives — nothing
// outside this module cares what the SVG looks like.
const OBJECTS = [
  { col: 5, row: 4, type: "chesstable", action: "room-start-match", label: "Neues Match" },
  { col: 2, row: 2, type: "crate" },
  { col: 3, row: 2, type: "crate" },
  { col: 9, row: 2, type: "counter" },
  { col: 9, row: 3, type: "npc", variant: "bartender", label: "Ewa" },
  { col: 8, row: 2, type: "vodka", action: "room-vodka", label: "Wodka" },
  { col: 3, row: 7, type: "trainingdummy" },
  { col: 5, row: 7, type: "bookshelf", action: "room-train-opening", label: "Eroeffnungsbuch" },
  { col: 7, row: 8, type: "npc", variant: "coach", label: "Coach" },
  { col: 1, row: 6, type: "crate" },
  { col: 8, row: 6, type: "crate" },
];

function sceneSize() {
  // Width needs to accomodate whichever axis (cols or rows) is longer:
  // rightmost extent requires cols*tileW, leftmost requires rows*tileW.
  const w = Math.max(ROOM.cols, ROOM.rows) * ROOM.tileW;
  const h = (ROOM.cols + ROOM.rows) * ROOM.tileH / 2 + 160; // slack for tall objects
  return { w, h };
}

function tileHTML(col, row) {
  const dark = (col + row) % 2 === 1;
  return `<div class="room-tile ${dark ? "d" : "l"}"
               style="--col:${col};--row:${row};"></div>`;
}

function objHTML(obj) {
  const { col, row, type, action, label } = obj;
  const art = ART[type]?.(obj) ?? ART.crate();
  const cls = `room-obj room-${type}${action ? " is-interactive" : ""}`;
  const dataAction = action ? `data-action="${action}"` : "";
  const lbl = label ? `<span class="room-obj-label">${label}</span>` : "";
  return `<div class="${cls}" style="--col:${col};--row:${row};" ${dataAction}>
    <div class="room-obj-art">${art}</div>
    ${lbl}
  </div>`;
}

// ---- Dummy SVG art per object type ----
// Each returns an SVG string. Viewbox 120x120 so they share a stage.
const ART = {
  chesstable: () => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <!-- table top (iso diamond) -->
      <polygon points="60,52 100,72 60,92 20,72" fill="#8b5a30"/>
      <polygon points="60,54 96,72 60,90 24,72" fill="#a26a3c"/>
      <!-- mini board pattern: 4x4 squares in iso -->
      ${miniBoard(60, 72)}
      <!-- legs -->
      <polygon points="24,74 28,75 28,108 24,106" fill="#4a2e18"/>
      <polygon points="92,74 96,76 96,108 92,106" fill="#4a2e18"/>
      <polygon points="58,89 62,91 62,112 58,110" fill="#4a2e18"/>
      <!-- king piece -->
      <g transform="translate(60,54)">
        <ellipse cx="0" cy="6" rx="8" ry="3" fill="#0d140d"/>
        <path d="M-4 4 Q-4 -10 0 -14 Q4 -10 4 4 Z" fill="#e9ffe0"/>
        <path d="M-3 -14 L3 -14 M0 -18 L0 -10" stroke="#e9ffe0" stroke-width="1.5"/>
      </g>
      <!-- glow + pulse when interactive -->
      <ellipse class="room-table-glow" cx="60" cy="72" rx="44" ry="12"
               fill="none" stroke="#7fff6a" stroke-width="1" opacity="0.55"/>
    </svg>`,

  crate: () => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <!-- top -->
      <polygon points="60,48 92,64 60,80 28,64" fill="#a26a3c"/>
      <!-- left face -->
      <polygon points="28,64 60,80 60,110 28,94" fill="#6b4423"/>
      <!-- right face -->
      <polygon points="92,64 60,80 60,110 92,94" fill="#8b5a30"/>
      <!-- plank lines -->
      <line x1="44" y1="72" x2="44" y2="102" stroke="#4a2e18" stroke-width="1"/>
      <line x1="76" y1="72" x2="76" y2="102" stroke="#4a2e18" stroke-width="1"/>
      <line x1="60" y1="80" x2="60" y2="110" stroke="#4a2e18" stroke-width="1"/>
    </svg>`,

  counter: () => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <polygon points="60,48 110,68 60,88 10,68" fill="#6b4423"/>
      <polygon points="10,68 60,88 60,112 10,92" fill="#4a2e18"/>
      <polygon points="110,68 60,88 60,112 110,92" fill="#5a3a20"/>
      <!-- bottles -->
      <rect x="40" y="40" width="4" height="14" fill="#3a5a3a"/>
      <rect x="50" y="36" width="4" height="18" fill="#5a3a3a"/>
      <rect x="60" y="42" width="4" height="12" fill="#3a5a3a"/>
      <rect x="70" y="38" width="4" height="16" fill="#5a3a3a"/>
    </svg>`,

  trainingdummy: () => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <!-- base -->
      <ellipse cx="60" cy="100" rx="22" ry="6" fill="#2c3a2e"/>
      <rect x="56" y="50" width="8" height="50" fill="#4a2e18"/>
      <!-- body shape -->
      <ellipse cx="60" cy="48" rx="16" ry="20" fill="#6b4423"/>
      <circle cx="60" cy="26" r="10" fill="#6b4423"/>
      <!-- targets -->
      <circle cx="60" cy="46" r="6" fill="#7fff6a" opacity="0.4"/>
      <circle cx="60" cy="46" r="3" fill="#7fff6a"/>
    </svg>`,

  npc: (o) => {
    if (o.variant === "bartender") return npcBartender();
    if (o.variant === "coach") return npcCoach();
    return npcGeneric();
  },

  vodka: () => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <!-- small iso table -->
      <polygon points="60,64 90,78 60,92 30,78" fill="#6b4423"/>
      <polygon points="30,78 60,92 60,110 30,96" fill="#4a2e18"/>
      <polygon points="90,78 60,92 60,110 90,96" fill="#5a3a20"/>
      <!-- bottle -->
      <rect x="54" y="28" width="12" height="40" rx="2" fill="#3a5a3a"/>
      <rect x="56" y="22" width="8"  height="10" rx="1" fill="#1e2f1e"/>
      <rect x="54" y="44" width="12" height="10" fill="#c0e8c0" opacity="0.85"/>
      <text x="60" y="51" text-anchor="middle"
            font-family="ui-monospace, Menlo, monospace"
            font-size="6" font-weight="700" fill="#0c1a0e">VOD</text>
      <!-- shot glass + spill -->
      <path d="M76 78 L82 78 L81 88 L77 88 Z" fill="#c0e8c0" opacity="0.9"/>
      <ellipse cx="79" cy="92" rx="6" ry="1.2" fill="#7fff6a" opacity="0.35"/>
    </svg>`,

  bookshelf: () => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <!-- table (iso) -->
      <polygon points="60,60 104,80 60,100 16,80" fill="#6b4423"/>
      <polygon points="16,80 60,100 60,116 16,96" fill="#4a2e18"/>
      <polygon points="104,80 60,100 60,116 104,96" fill="#5a3a20"/>
      <!-- stack of books on top -->
      <rect x="38" y="46" width="44" height="8" rx="1" fill="#5a3a3a"/>
      <rect x="34" y="54" width="52" height="8" rx="1" fill="#3a5a3a"/>
      <rect x="40" y="62" width="40" height="8" rx="1" fill="#3a3a5a"/>
      <!-- open book -->
      <g transform="translate(60,42)">
        <path d="M-14 -2 Q0 2 14 -2 L14 8 Q0 12 -14 8 Z" fill="#c0e8c0"/>
        <path d="M0 -1 L0 10" stroke="#6a8e6a" stroke-width="0.8"/>
        <line x1="-10" y1="2" x2="-2" y2="2" stroke="#2c3a2e" stroke-width="0.5"/>
        <line x1="-10" y1="5" x2="-2" y2="5" stroke="#2c3a2e" stroke-width="0.5"/>
        <line x1="2"   y1="2" x2="10" y2="2" stroke="#2c3a2e" stroke-width="0.5"/>
        <line x1="2"   y1="5" x2="10" y2="5" stroke="#2c3a2e" stroke-width="0.5"/>
      </g>
    </svg>`,
};

function miniBoard(cx, cy) {
  // 4x4 mini checker pattern rendered as small diamonds.
  const s = 8;
  let out = "";
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const dx = (c - r) * s;
      const dy = (c + r) * s / 2;
      const dark = (r + c) % 2 === 1;
      const color = dark ? "#0c1a0e" : "#c0e8c0";
      out += `<polygon points="${cx+dx},${cy+dy-s/2} ${cx+dx+s},${cy+dy} ${cx+dx},${cy+dy+s/2} ${cx+dx-s},${cy+dy}" fill="${color}" opacity="0.85"/>`;
    }
  }
  return out;
}

function npcBartender() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="18" ry="4" fill="#000" opacity="0.45"/>
    <!-- apron body -->
    <path d="M44 70 Q40 100 46 108 L74 108 Q80 100 76 70 Z" fill="#4a2e18"/>
    <!-- shirt -->
    <path d="M44 60 Q44 72 60 72 Q76 72 76 60 L70 54 Q60 58 50 54 Z" fill="#c0e8c0"/>
    <!-- head -->
    <ellipse cx="60" cy="44" rx="12" ry="14" fill="#2c3a2e"/>
    <!-- hair bun -->
    <circle cx="60" cy="30" r="6" fill="#0c1a0e"/>
    <!-- eyes -->
    <circle cx="55" cy="46" r="1.2" fill="#c0e8c0"/>
    <circle cx="65" cy="46" r="1.2" fill="#c0e8c0"/>
  </svg>`;
}

function npcCoach() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="18" ry="4" fill="#000" opacity="0.45"/>
    <!-- jacket -->
    <path d="M42 68 Q38 102 46 108 L74 108 Q82 102 78 68 L68 60 Q60 64 52 60 Z" fill="#14231a"/>
    <!-- lapel stripe -->
    <path d="M58 68 L58 100 M62 68 L62 100" stroke="#7fff6a" stroke-width="1.2" opacity="0.7"/>
    <!-- head -->
    <ellipse cx="60" cy="44" rx="12" ry="14" fill="#2c3a2e"/>
    <!-- beard -->
    <path d="M50 52 Q60 58 70 52 Q68 60 60 62 Q52 60 50 52 Z" fill="#0c1a0e"/>
    <!-- eyes -->
    <circle cx="55" cy="44" r="1.2" fill="#c0e8c0"/>
    <circle cx="65" cy="44" r="1.2" fill="#c0e8c0"/>
    <!-- clipboard -->
    <rect x="76" y="74" width="10" height="14" fill="#8b5a30" stroke="#4a2e18" stroke-width="0.8"/>
  </svg>`;
}

function npcGeneric() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="18" ry="4" fill="#000" opacity="0.45"/>
    <path d="M44 68 Q40 100 46 108 L74 108 Q80 100 76 68 Z" fill="#2c3a2e"/>
    <ellipse cx="60" cy="44" rx="12" ry="14" fill="#2c3a2e"/>
  </svg>`;
}

export function renderRoomHTML() {
  const { w, h } = sceneSize();
  const tiles = [];
  for (let r = 0; r < ROOM.rows; r++) {
    for (let c = 0; c < ROOM.cols; c++) tiles.push(tileHTML(c, r));
  }
  const objects = OBJECTS.map(objHTML).join("");

  return `<div class="iso-room-wrapper" id="roomWrap">
    <div class="iso-room-scene"
         style="--tile-w:${ROOM.tileW}px;--tile-h:${ROOM.tileH}px;
                --scene-w:${w}px;--scene-h:${h}px;
                width:${w}px;height:${h}px;">
      <div class="room-floor">${tiles.join("")}</div>
      <div class="room-objects">${objects}</div>
    </div>
    <div class="iso-room-help">Ziehen zum Bewegen · Objekt klicken zum Interagieren</div>
  </div>`;
}

// Drag-to-pan. Returns a cleanup function. The room wrapper must already be
// in the DOM when this runs. We track movement amount so a drag doesn't also
// fire a click on the object under the pointer.
export function bindRoomDrag(wrapper) {
  if (!wrapper) return () => {};
  // Start roughly centered on the chess table.
  const scene = wrapper.querySelector(".iso-room-scene");
  if (scene) {
    const w = scene.offsetWidth, h = scene.offsetHeight;
    wrapper.scrollLeft = Math.max(0, (w - wrapper.clientWidth) / 2);
    wrapper.scrollTop  = Math.max(0, (h - wrapper.clientHeight) / 2);
  }

  let down = false;
  let startX = 0, startY = 0;
  let startScrollX = 0, startScrollY = 0;
  let moved = false;
  const MOVE_THRESHOLD = 4;

  const onDown = (e) => {
    // Ignore right-click and interactive object clicks (we want those to go
    // straight to main.js's delegation without starting a pan).
    if (e.button !== undefined && e.button !== 0) return;
    down = true;
    moved = false;
    startX = e.pageX;
    startY = e.pageY;
    startScrollX = wrapper.scrollLeft;
    startScrollY = wrapper.scrollTop;
    wrapper.classList.add("is-dragging");
  };
  const onMove = (e) => {
    if (!down) return;
    const dx = e.pageX - startX;
    const dy = e.pageY - startY;
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) moved = true;
    wrapper.scrollLeft = startScrollX - dx;
    wrapper.scrollTop  = startScrollY - dy;
  };
  const onUp = () => {
    if (!down) return;
    down = false;
    wrapper.classList.remove("is-dragging");
  };
  const onClickCapture = (e) => {
    if (moved) { e.stopPropagation(); e.preventDefault(); }
  };

  wrapper.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  wrapper.addEventListener("click", onClickCapture, true);

  return () => {
    wrapper.removeEventListener("mousedown", onDown);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    wrapper.removeEventListener("click", onClickCapture, true);
  };
}
