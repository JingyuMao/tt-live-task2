import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AUDIO_FILES } from '../src/utils/audio.js';
const root = fileURLToPath(new URL('../', import.meta.url));
// Bundle from current source, never from a previous generated HTML file.
const result = await build({
  root, configFile: false, base: './',
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    write: false, minify: true, cssCodeSplit: false,
    lib: { entry: path.join(root, 'src/main.jsx'), name: 'TTLive', formats: ['iife'] },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
const js = outputs.filter(o => o.type === 'chunk').map(o => o.code).join('\n');
const css = outputs.filter(o => o.type === 'asset' && o.fileName.endsWith('.css')).map(o => o.source).join('\n');
const read = p => readFile(path.join(root, p));
const loader = await read('public/vendor/wasm/vision_wasm_internal.js');
const vision = await read('public/vendor/vision_bundle.js');
const handler = await read('public/tracker-worker.js');
const worker = `${loader}\nconst EMBEDDED_LOADER='embedded:vision_wasm_internal.js';
const nativeImportScripts=self.importScripts.bind(self);
self.importScripts=(...urls)=>{const rest=urls.filter(u=>String(u)!==EMBEDDED_LOADER);if(rest.length)nativeImportScripts(...rest);};
self.exports={};\n${vision}\n${handler}`;
const embed = (id, bytes) => `<script type="application/octet-stream" id="${id}">${Buffer.from(bytes).toString('base64')}</script>`;
const parts = [embed('ew-worker', worker), embed('ew-wasm', await read('public/vendor/wasm/vision_wasm_internal.wasm')), embed('ew-model', await read('public/vendor/face_landmarker.task'))];
for (const name of AUDIO_FILES) parts.push(embed('ew-audio-' + name, await read('public/assets/audio/' + name)));
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TT直播间特效 · LIVE Studio</title><style>${css}</style></head><body><div id="root"></div>${parts.join('\n')}<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
const out = path.join(root, 'TT直播间特效.html');
await writeFile(out, html);
console.log(`已生成 ${out} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`);
