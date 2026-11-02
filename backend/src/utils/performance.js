const { performance } = require("perf_hooks");

const timingWindow = [];
const MAX_SAMPLES = 200;

function recordTiming(label, durationMs) {
  const sample = { label, durationMs, timestamp: Date.now() };
  timingWindow.push(sample);
  if (timingWindow.length > MAX_SAMPLES) {
    timingWindow.splice(0, timingWindow.length - MAX_SAMPLES);
  }
}

function getAverageTiming(label) {
  const matches = timingWindow.filter((entry) => entry.label === label);
  if (!matches.length) return 0;
  const sum = matches.reduce((total, entry) => total + Number(entry.durationMs || 0), 0);
  return sum / matches.length;
}

function getPerformanceSnapshot() {
  const labels = [...new Set(timingWindow.map((entry) => entry.label))];
  const byLabel = Object.fromEntries(
    labels.map((label) => [label, getAverageTiming(label)])
  );

  const recent = timingWindow.slice(-20).map((entry) => ({
    label: entry.label,
    durationMs: Number(entry.durationMs || 0),
    timestamp: entry.timestamp,
  }));

  const average =
    timingWindow.length > 0
      ? timingWindow.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0) / timingWindow.length
      : 0;

  return {
    samples: timingWindow.length,
    averageMs: Number(average.toFixed(2)),
    byLabel,
    recent,
    generatedAt: Date.now(),
  };
}

function requestTimingMiddleware(req, res, next) {
  const startedAt = performance.now();
  const originalEnd = res.end;
  const routeKey = `${req.method} ${req.originalUrl || req.url}`;

  res.end = function end(...args) {
    const durationMs = Number((performance.now() - startedAt).toFixed(2));

    if (!res.headersSent) {
      res.setHeader("X-Response-Time-Ms", String(durationMs));
    }

    recordTiming(routeKey, durationMs);
    return originalEnd.apply(this, args);
  };

  next();
}

module.exports = {
  getPerformanceSnapshot,
  recordTiming,
  requestTimingMiddleware,
};
