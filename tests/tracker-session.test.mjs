import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackerSession } from '../src/utils/trackerSession.js';
function fixture() {
  const workers = [], events = [];
  const session = new TrackerSession(() => {
    const worker = { sent: [], postMessage(data) { this.sent.push(data); }, terminate() { this.stopped = true; } };
    workers.push(worker);
    return { worker, init: { type: 'init' }, dispose() {} };
  }, { onPreparation: p => events.push(p), onReady: () => events.push('camera-ready'), onResult: () => events.push('frame'), onError: () => events.push('error-visible') });
  return { session, workers, events, reply: data => workers.at(-1).onmessage({ data }) };
}
test('opening prepares model without camera frames; reopening reuses the worker', () => {
  const f = fixture();
  try {
    f.session.prepare();
    assert.deepEqual(f.workers[0].sent, [{ type: 'init' }]);
    f.reply({ type: 'ready' });
    assert.deepEqual(f.events, ['loading', 'ready']);
    assert.equal(f.session.canSend(), false);
    f.session.setEnabled(true);
    assert.equal(f.events.at(-1), 'camera-ready');
    f.session.setEnabled(false); f.session.setEnabled(true);
    assert.equal(f.workers.length, 1);
  } finally { f.session.dispose(); }
});
test('clicking before preparation completes waits for ready; closed camera stays idle', () => {
  const f = fixture();
  try {
    f.session.prepare(); f.session.setEnabled(true);
    assert.equal(f.session.canSend(), false);
    f.session.setEnabled(false); f.reply({ type: 'ready' });
    assert.ok(!f.events.includes('camera-ready'));
  } finally { f.session.dispose(); }
});
test('failed preload retries on activation; stale in-flight frames cannot cross camera sessions', () => {
  const f = fixture();
  try {
    f.session.prepare(); f.reply({ type: 'error', message: 'offline' });
    assert.ok(!f.events.includes('error-visible'));
    f.session.setEnabled(true); assert.equal(f.workers.length, 2);
    f.reply({ type: 'ready' });
    f.session.sendFrame({ close() {} }, 100, f.session.epoch);
    f.session.setEnabled(false); f.session.setEnabled(true);
    f.reply({ type: 'result', ms: 5 });
    assert.ok(!f.events.includes('frame'));
    f.session.sendFrame({ close() {} }, 200, f.session.epoch);
    f.reply({ type: 'result', ms: 5 });
    assert.equal(f.events.at(-1), 'frame');
  } finally { f.session.dispose(); }
});
test('dispose terminates worker and ignores late initialization', () => {
  const f = fixture(); f.session.prepare(); f.session.dispose();
  f.reply({ type: 'ready' });
  assert.equal(f.workers[0].stopped, true);
  assert.deepEqual(f.events, ['loading']);
});
