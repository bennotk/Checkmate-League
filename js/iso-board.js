// Isometric chess field renderer.
// Dummy visuals (CSS-drawn diamond tiles + Unicode pieces). Swap art later by
// replacing .iso-tile / .iso-piece backgrounds with image assets.
//
// Coordinate system:
//   col (f) = 0..7 left-to-right on the rank (file a..h)
//   row (r) = 0..7 top-to-bottom on the board (rank 8..1)
// Isometric screen mapping uses CSS calc() against --tile-w / --tile-h, so the
// whole board scales with its container and works at any size (incl. fullscreen).

const UNICODE = {
  wK: "\u2654", wQ: "\u2655", wR: "\u2656", wB: "\u2657", wN: "\u2658", wP: "\u2659",
  bK: "\u265A", bQ: "\u265B", bR: "\u265C", bB: "\u265D", bN: "\u265E", bP: "\u265F",
};

function fileLetter(f) { return "abcdefgh"[f]; }
function squareName(f, r) { return fileLetter(f) + (8 - r); }

function tileHTML(f, r, dark, highlighted, sq) {
  return `<div class="iso-tile ${dark ? "d" : "l"}${highlighted ? " hl" : ""}"
               style="--col:${f};--row:${r};"
               data-sq="${sq}"></div>`;
}

function pieceHTML(piece, f, r) {
  const key = (piece.color === "w" ? "w" : "b") + piece.type.toUpperCase();
  const glyph = UNICODE[key] ?? "";
  const colorCls = piece.color === "w" ? "white" : "black";
  return `<div class="iso-piece ${colorCls}"
               style="--col:${f};--row:${r};"
               data-piece="${key}">
            <span class="iso-piece-shadow"></span>
            <span class="iso-piece-glyph">${glyph}</span>
          </div>`;
}

// board: 8x8 array from chess.js (board()[row][file]); lastMove: { from, to } | null.
export function renderIsoBoardHTML(board, lastMove) {
  const tiles = [];
  const pieces = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dark = (r + f) % 2 === 1;
      const sq = squareName(f, r);
      const hl = !!(lastMove && (lastMove.from === sq || lastMove.to === sq));
      tiles.push(tileHTML(f, r, dark, hl, sq));
      const p = board?.[r]?.[f];
      if (p) pieces.push(pieceHTML(p, f, r));
    }
  }
  // iso-pieces is a sibling layer so pieces always render above tile highlights.
  return `<div class="iso-scene">
      <div class="iso-board">${tiles.join("")}</div>
      <div class="iso-pieces">${pieces.join("")}</div>
    </div>`;
}

// Placeholder when no chess.js position is available yet (pregame preview).
export function renderIsoBoardPlaceholder() {
  const fakeBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
  // Seed a default starting position so the tile system shows life at once.
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let f = 0; f < 8; f++) {
    fakeBoard[0][f] = { color: "b", type: back[f] };
    fakeBoard[1][f] = { color: "b", type: "p" };
    fakeBoard[6][f] = { color: "w", type: "p" };
    fakeBoard[7][f] = { color: "w", type: back[f] };
  }
  return renderIsoBoardHTML(fakeBoard, null);
}

// Wires up the fullscreen toggle button inside the given root element.
// Uses the standard Fullscreen API against the closest .iso-wrapper.
export function bindIsoFullscreen(root) {
  if (!root) return;
  const btn = root.querySelector("[data-iso-fullscreen]");
  const target = root.querySelector(".iso-wrapper") ?? root;
  if (!btn || !target) return;
  btn.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      target.requestFullscreen?.();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const active = document.fullscreenElement === target;
    target.classList.toggle("is-fullscreen", active);
    btn.textContent = active ? "[ exit fullscreen ]" : "[ fullscreen ]";
  });
}
