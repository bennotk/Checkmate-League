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

    // info-Zeilen enthalten die Evaluation waehrend der Suche
    if (line.startsWith("info ")) {
      const cp = line.match(/score cp (-?\d+)/);
      if (cp) p.lastCp = parseInt(cp[1], 10);
      const mate = line.match(/score mate (-?\d+)/);
      if (mate) {
        const m = parseInt(mate[1], 10);
        p.lastMate = m;
        // Als grosser Zahlenwert fuer Eval: mate+ = sehr gut; mate- = sehr schlecht.
        p.lastCp = m > 0 ? 100000 : -100000;
      }
      return;
    }

    if (line.startsWith("bestmove")) {
      const parts = line.split(/\s+/);
      const bestmove = parts[1] || null;
      const done = this._pending;
      this._pending = null;
      if (done.kind === "bestmove") {
        done.resolve(bestmove);
      } else if (done.kind === "evaluate") {
        done.resolve({ bestmove, cp: done.lastCp ?? 0, mate: done.lastMate ?? null });
      }
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

  /** Bestmove fuer FEN finden, mit begrenzter Bedenkzeit. */
  go(fen, movetimeMs = 500) {
    return this._enqueue({
      kind: "bestmove",
      cmds: [`position fen ${fen}`, `go movetime ${movetimeMs}`],
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
