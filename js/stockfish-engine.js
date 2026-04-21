// Stockfish-Wrapper: startet den Engine-Worker und spricht UCI.
//
// Der Stockfish-Worker (vendor/stockfish.js) ist ein klassischer Web Worker.
// Wir kapseln das Kommandointerface, damit UI-Code einfach bleibt:
//   const sf = new StockfishEngine({ path: "vendor/stockfish.js" });
//   await sf.ready;
//   sf.setSkillLevel(8);
//   const bestmove = await sf.go(fen, 500);     // "e2e4"
//   const { bestmove, cp } = await sf.evaluate(fen, 12);
//
// Wichtig: Befehle laufen sequenziell. Kein paralleler go/evaluate auf derselben
// Instanz. Deshalb haben wir eine simple Queue.

export class StockfishEngine {
  constructor({ path = "vendor/stockfish.js", label = "sf" } = {}) {
    this.label = label;
    this.worker = new Worker(path);
    this.skill = 10;
    this._pending = null;   // aktuell laufender Auftrag
    this._queue = [];
    this._readyRes = null;
    this.ready = new Promise((res) => { this._readyRes = res; });

    this.worker.onmessage = (e) => {
      const data = typeof e.data === "string" ? e.data : String(e.data);
      this._onLine(data);
    };
    this.worker.onerror = (err) => {
      console.error(`[${this.label}] worker error:`, err);
    };

    this._send("uci");
  }

  _send(cmd) { this.worker.postMessage(cmd); }

  _onLine(line) {
    if (!line) return;
    if (line === "uciok") { this._send("isready"); return; }
    if (line === "readyok") {
      if (this._readyRes) { this._readyRes(); this._readyRes = null; }
      this._drain();
      return;
    }
    const p = this._pending;
    if (!p) return;

    // info-Zeilen enthalten die Evaluation waehrend der Suche. Mit MultiPV>1
    // gibt es eine Zeile pro PV-Index; wir sammeln per Index den aktuellsten
    // (= tiefsten) Eintrag.
    if (line.startsWith("info ")) {
      const mpvM = line.match(/multipv (\d+)/);
      const idx = mpvM ? parseInt(mpvM[1], 10) : 1;
      const cpM = line.match(/score cp (-?\d+)/);
      const mateM = line.match(/score mate (-?\d+)/);
      const pvI = line.indexOf(" pv ");
      const firstMove = pvI >= 0
        ? line.substring(pvI + 4).trim().split(/\s+/)[0]
        : null;

      if (!p.pvs) p.pvs = {};
      const entry = p.pvs[idx] ?? (p.pvs[idx] = {});
      if (cpM) entry.cp = parseInt(cpM[1], 10);
      if (mateM) {
        entry.mate = parseInt(mateM[1], 10);
        entry.cp = entry.mate > 0 ? 100000 : -100000;
      }
      if (firstMove) entry.move = firstMove;

      // Primaer-PV zur Abwaertskompatibilitaet (cp/mate im alten go-Return).
      if (idx === 1) {
        if (cpM) p.lastCp = parseInt(cpM[1], 10);
        if (mateM) {
          p.lastMate = parseInt(mateM[1], 10);
          p.lastCp = p.lastMate > 0 ? 100000 : -100000;
        }
      }
      return;
    }

    if (line.startsWith("bestmove")) {
      const parts = line.split(/\s+/);
      const bestmove = parts[1] || null;
      const done = this._pending;
      this._pending = null;

      // Sortierte PV-Liste nach Rang (1..N).
      const pvs = [];
      if (done.pvs) {
        for (let i = 1; i <= (done.multiPv ?? 1); i++) {
          const e = done.pvs[i];
          if (e && e.move) pvs.push({ rank: i, move: e.move, cp: e.cp ?? 0, mate: e.mate ?? null });
        }
      }
      if (pvs.length === 0 && bestmove) {
        pvs.push({ rank: 1, move: bestmove, cp: done.lastCp ?? 0, mate: done.lastMate ?? null });
      }

      done.resolve({
        bestmove,
        cp: pvs[0]?.cp ?? done.lastCp ?? 0,
        mate: pvs[0]?.mate ?? done.lastMate ?? null,
        pvs,
      });
      this._drain();
    }
  }

  _drain() {
    if (this._pending) return;
    const next = this._queue.shift();
    if (!next) return;
    this._pending = next;
    for (const cmd of next.cmds) this._send(cmd);
  }

  _enqueue(job) {
    return new Promise((resolve) => {
      this._queue.push({ ...job, resolve });
      this._drain();
    });
  }

  /** Skill Level setzen (0..20). Wird direkt an die Engine weitergegeben. */
  setSkillLevel(level) {
    const clamped = Math.max(0, Math.min(20, Math.round(level)));
    if (clamped === this.skill) return;
    this.skill = clamped;
    this._send(`setoption name Skill Level value ${clamped}`);
  }

  /** Stockfish bittet in neues Spiel (clear hash, alle states zuruecksetzen). */
  newGame() {
    this._send("ucinewgame");
  }

  /** Bestmove + PV-Liste fuer FEN finden.
   *  opts: number (movetimeMs) | { movetimeMs, multiPv }.
   *  Rueckgabe: { bestmove, cp, mate, pvs: [{rank, move, cp, mate}] }. */
  go(fen, opts = 500) {
    const movetimeMs = typeof opts === "number" ? opts : (opts.movetimeMs ?? 500);
    const multiPv = typeof opts === "number" ? 1 : Math.max(1, Math.min(20, opts.multiPv ?? 1));
    return this._enqueue({
      kind: "bestmove",
      multiPv,
      cmds: [
        `setoption name MultiPV value ${multiPv}`,
        `position fen ${fen}`,
        `go movetime ${movetimeMs}`,
      ],
    });
  }

  /** Evaluation + Bestmove fuer FEN, mit Tiefenbegrenzung. */
  evaluate(fen, depth = 12) {
    return this._enqueue({
      kind: "evaluate",
      cmds: [`position fen ${fen}`, `go depth ${depth}`],
    });
  }

  stop() {
    this._send("stop");
  }

  destroy() {
    try { this._send("quit"); } catch {}
    this.worker.terminate();
  }
}
