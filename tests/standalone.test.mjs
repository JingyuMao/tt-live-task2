import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIO, AUDIO_FILES } from '../src/utils/audio.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const attachment = path.join(root, 'TT直播间特效.html');
const newest = dir => readdirSync(dir, { withFileTypes: true }).reduce((t, e) => {
  if (e.name === '.DS_Store') return t;
  const p = path.join(dir, e.name);
  return Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
}, 0);

test('every AUDIO track exists, and no unused audio is shipped', () => {
  for (const effect of ['rain', 'fireworks']) {
    assert.ok(AUDIO[effect].tracks.length > 0, effect);
    for (const spec of AUDIO[effect].tracks) {
      assert.ok(existsSync(path.join(root, 'public/assets/audio', spec.file)), spec.file);
      assert.ok(spec.gain > 0 && spec.start >= 0 && spec.delay >= 0 && spec.fadeIn > 0, `${effect}: ${spec.file}`);
    }
  }
  const shipped = readdirSync(path.join(root, 'public/assets/audio')).filter(f => f.endsWith('.mp3')).sort();
  assert.deepEqual(shipped, [...AUDIO_FILES].sort(), 'public/assets/audio should only contain files listed in AUDIO');
});

// 单文件版本是可选的本地产物（不入仓库）；存在时检查它没有落后于源码。
test('TT直播间特效.html, if present, is regenerated after the latest source change', { skip: !existsSync(attachment) && 'not generated' }, () => {
  const source = Math.max(newest(path.join(root, 'src')), newest(path.join(root, 'public')), statSync(path.join(root, 'scripts/build-standalone.mjs')).mtimeMs);
  assert.ok(statSync(attachment).mtimeMs >= source, 'TT直播间特效.html is older than src/public — regenerate it');
});
