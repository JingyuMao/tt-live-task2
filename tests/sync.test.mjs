import test from 'node:test';
import assert from 'node:assert/strict';
import { StarRain } from '../src/engines/rain.js';
import { RAIN_DURATION_MS } from '../src/utils/expression.js';
import { AUDIO } from '../src/utils/audio.js';

// 星雨画面看得见的部分（触发窗口 + 淡出到亮度低于 5%）应与星雨音乐的实际播放时长一致。
// 亮度低于 5% 后肉眼已基本看不到，余光再持续约 0.4 秒，不计入。
test('star rain visuals last as long as the star rain music', () => {
  for (const fps of [30, 60]) {
    const rain = new StarRain({ random: () => .5 }), dt = 1 / fps;
    let t = 0;
    for (; t < RAIN_DURATION_MS / 1000; t += dt) rain.update(dt, true, 390, 845);
    while (rain.level >= .05 && t < 10) { rain.update(dt, false, 390, 845); t += dt; }
    const music = Math.max(...AUDIO.rain.tracks.map(s => s.delay + s.duration - s.start));
    assert.ok(Math.abs(t - music) < 0.1, `${fps} FPS: visible rain ${t.toFixed(2)}s vs music ${music.toFixed(2)}s`);
  }
});
