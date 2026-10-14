import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameLoop } from '../src/utils/frameLoop.js';
import { Fireworks } from '../src/engines/fireworks.js';
import { StarRain } from '../src/engines/rain.js';
test('idle and stopped loops schedule no frames; repeated starts never duplicate work', () => {
  const queue = new Map(); let id = 0, frames = 0;
  const loop = createFrameLoop(() => frames++, fn => { queue.set(++id, fn); return id; }, id => queue.delete(id));
  assert.equal(queue.size, 0);
  loop.start(); loop.start(); assert.equal(queue.size, 1);
  const [key, callback] = [...queue][0]; queue.delete(key); callback(100);
  assert.equal(frames, 1); assert.equal(queue.size, 1);
  loop.stop(); assert.equal(queue.size, 0);
  callback(200); assert.equal(frames, 1);
  loop.start(); assert.equal(queue.size, 1); loop.stop();
});
test('inactive effects do not iterate particle pools', () => {
  const rain = new StarRain(), fireworks = new Fireworks();
  for (const effect of [rain, fireworks]) effect.pool[Symbol.iterator] = () => { throw new Error('idle pool scanned'); };
  for (let frame = 0; frame < 300; frame++) {
    assert.equal(rain.update(1/30, false, 390, 845), 0);
    assert.equal(fireworks.update(1/30, [], 390, 845), 0);
  }
});
