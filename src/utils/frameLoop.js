// No callbacks are queued while inactive. Repeated start calls cannot create duplicate loops.
export function createFrameLoop(frame, request = requestAnimationFrame, cancel = cancelAnimationFrame) {
  let running = false, handle = null;
  const tick = now => {
    handle = null;
    if (!running) return;
    frame(now);
    if (running) handle = request(tick);
  };
  return {
    start() { if (!running) { running = true; handle = request(tick); } },
    stop() { running = false; if (handle !== null) cancel(handle); handle = null; },
  };
}
