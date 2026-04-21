// Isometric chess field renderer.
// Dummy visuals (CSS-drawn diamond tiles + Unicode pieces). Swap art later by
// replacing .iso-tile / .iso-piece backgrounds with image assets.
//
// Coordinate system:
//   col (f) = 0..7 left-to-right on the rank (file a..h)
//   row (r) = 0..7 top-to-bottom on the board (rank 8..1)
// Isometric screen mapping uses CSS calc() against --tile-w / --tile-h, so the
// whole board scales with its container and works at any size (incl. fullscreen).
//
// Move animation: the moving piece is rendered already at its destination tile,
// but given CSS custom properties pointing back to its origin. A keyframe then
// interpolates lift -> slide -> drop. Captured pieces get an overlay element
// that spins off the board before vanishing.

const UNICODE = {
  wK: "\u2654", wQ: "\u2655", wR: "\u2656", wB: "\u2657", wN: "\u2658", wP: "\u2659",
  bK: "\u265A", bQ: "\u265B", bR: "\u265C", bB: "\u265D", bN: "\u265E", bP: "\u265F",
};

function fileLetter(f) { return "abcdefgh"[f]; }
function squareName(f, r) { return fileLetter(f) + (8 - r); }
function squareToFR(sq) {
  const f = "abcdefgh".indexOf(sq[0]);
  const r = 8 - parseInt(sq[1], 10);
  return { f, r };
}

// Tracks which move we've already emitted animation markup for. Prevents
// stray re-renders (e.g. a cast triggering patchLive) from replaying the move.
let lastAnimatedMoveKey = null;

function tileHTML(f, r, dark, highlighted, sq, selected) {
  const cls = [dark ? "d" : "l"];
  if (highlighted) cls.push("hl");
  if (selected) cls.push("selected");
  return `<div class="iso-tile ${cls.join(" ")}"
               style="--col:${f};--row:${r};"
               data-sq="${sq}"></div>`;
}

function pieceHTML(piece, f, r, opts = {}) {
  const key = (piece.color === "w" ? "w" : "b") + piece.type.toUpperCase();
  const glyph = UNICODE[key] ?? "";
  const colorCls = piece.color === "w" ? "white" : "black";

  let extraCls = "";
  let style = `--col:${f};--row:${r};`;
  if (opts.moving) {
    extraCls = " is-moving";
    // Iso deltas the keyframes interpolate against.
    style += `--move-dcol:${opts.dCol};--move-drow:${opts.dRow};`;
  }
  if (opts.captured) {
    extraCls = " is-captured";
  }
  return `<div class="iso-piece ${colorCls}${extraCls}"
               style="${style}"
               data-piece="${key}">
            <span class="iso-piece-shadow"></span>
            <span class="iso-piece-glyph">${glyph}</span>
          </div>`;
}

// File labels (a..h) sit under the rank-1 row; rank labels (8..1) sit left of
// the file-a column. Positions use the same iso math as tiles so everything
// lines up at any zoom level.
function renderFileLabelsHTML() {
  const files = "abcdefgh";
  let html = "";
  for (let f = 0; f < 8; f++) {
    html += `<span class="iso-file-label" style="--col:${f};">${files[f]}</span>`;
  }
  return html;
}
function renderRankLabelsHTML() {
  let html = "";
  for (let r = 0; r < 8; r++) {
    html += `<span class="iso-rank-label" style="--row:${r};">${8 - r}</span>`;
  }
  return html;
}

// board: 8x8 array from chess.js (board()[row][file]);
// lastMove: { from, to, color, captured? } | null.
// opts.selectedSq highlights a square as the "chosen piece" in cheat mode.
export function renderIsoBoardHTML(board, lastMove, opts = {}) {
  const tiles = [];
  const pieces = [];
  const selectedSq = opts.selectedSq ?? null;

  // Cheat-Zuege sollen nicht die normale Move-Animation ausloesen.
  const isCheatMove = !!(lastMove && lastMove.cheat);
  const moveKey = lastMove && !isCheatMove
    ? `${lastMove.from}-${lastMove.to}-${lastMove.san ?? ""}`
    : null;
  const animateMove = !!moveKey && moveKey !== lastAnimatedMoveKey;
  if (animateMove) lastAnimatedMoveKey = moveKey;

  let fromFR = null;
  if (animateMove) fromFR = squareToFR(lastMove.from);

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dark = (r + f) % 2 === 1;
      const sq = squareName(f, r);
      const hl = !!(lastMove && (lastMove.from === sq || lastMove.to === sq));
      const selected = selectedSq === sq;
      tiles.push(tileHTML(f, r, dark, hl, sq, selected));
      const p = board?.[r]?.[f];
      if (!p) continue;
      const isMover = animateMove && sq === lastMove.to;
      if (isMover) {
        pieces.push(pieceHTML(p, f, r, {
          moving: true,
          dCol: fromFR.f - f,
          dRow: fromFR.r - r,
        }));
      } else {
        pieces.push(pieceHTML(p, f, r));
      }
    }
  }

  // Phantom captured piece: chess.js removes it from the board before we render,
  // so we stage it back at the destination square and spin it off.
  if (animateMove && lastMove.captured) {
    const toFR = squareToFR(lastMove.to);
    const capturedColor = lastMove.color === "w" ? "b" : "w";
    const fake = { color: capturedColor, type: lastMove.captured };
    pieces.push(pieceHTML(fake, toFR.f, toFR.r, { captured: true }));
  }

  return `<div class="iso-scene">
      <div class="iso-board">${tiles.join("")}</div>
      <div class="iso-pieces">${pieces.join("")}</div>
      <div class="iso-labels">
        ${renderFileLabelsHTML()}
        ${renderRankLabelsHTML()}
      </div>
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
