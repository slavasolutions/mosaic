"use strict";

// Diagnostic accumulator. Stable codes per SPEC §6.

const SEV_STRUCTURAL = "structural";
const SEV_DRIFT = "drift";
const SEV_WARNING = "warning";

const SEVERITY_ORDER = {
  structural: 0,
  drift: 1,
  warning: 2,
};

class Diagnostics {
  constructor() {
    this._items = [];
  }

  add(severity, code, source, message, extra) {
    const d = {
      severity,
      code,
      source: source || "",
      message: message || "",
    };
    if (extra && typeof extra === "object") {
      for (const k of Object.keys(extra)) {
        if (!(k in d)) d[k] = extra[k];
      }
    }
    this._items.push(d);
  }

  structural(code, source, message, extra) {
    this.add(SEV_STRUCTURAL, code, source, message, extra);
  }
  drift(code, source, message, extra) {
    this.add(SEV_DRIFT, code, source, message, extra);
  }
  warning(code, source, message, extra) {
    this.add(SEV_WARNING, code, source, message, extra);
  }

  has(code) {
    return this._items.some((d) => d.code === code);
  }

  summary() {
    const s = { structural: 0, drift: 0, warning: 0 };
    for (const d of this._items) {
      if (d.severity in s) s[d.severity]++;
    }
    return s;
  }

  // Stable order: severity, then code, then source.
  sorted() {
    return this._items.slice().sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity] ?? 9;
      const sb = SEVERITY_ORDER[b.severity] ?? 9;
      if (sa !== sb) return sa - sb;
      if (a.code !== b.code) return a.code < b.code ? -1 : 1;
      if (a.source !== b.source) return a.source < b.source ? -1 : 1;
      if (a.message !== b.message) return a.message < b.message ? -1 : 1;
      return 0;
    });
  }
}

module.exports = {
  Diagnostics,
  SEV_STRUCTURAL,
  SEV_DRIFT,
  SEV_WARNING,
};
