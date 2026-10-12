// The same component can run from a hosted build or the generated offline HTML.
export function createTracker() {
  const embedded = document.getElementById('ew-worker');
  if (!embedded) return {
    worker: new Worker(`${import.meta.env.BASE_URL}tracker-worker.js`),
    init: { type: 'init' },
    dispose() {},
  };
  const bytes = id => Uint8Array.from(atob(document.getElementById(id).textContent.trim()), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes('ew-worker')], { type: 'text/javascript' }));
  try {
    return {
      worker: new Worker(url),
      init: {
        type: 'init',
        binaryUrl: 'data:application/wasm;base64,' + document.getElementById('ew-wasm').textContent.trim(),
        model: bytes('ew-model'),
      },
      dispose() { URL.revokeObjectURL(url); },
    };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

// 与 MediaPipe 选择 WASM 版本时使用的同一个 SIMD 探测模块。
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

/**
 * 页面空闲时预先下载识别所需文件（约 13 MB）到浏览器 HTTP 缓存，开启摄像头时 Worker 直接命中缓存。
 * 只下载本浏览器会用到的 WASM 版本；单文件版本已内嵌、或用户开启省流量时跳过。
 * 返回取消函数。
 */
export function prefetchTrackerAssets() {
  if (document.getElementById('ew-worker') || navigator.connection?.saveData) return () => {};
  const base = import.meta.env.BASE_URL;
  const wasm = WebAssembly.validate(SIMD_PROBE) ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
  const files = ['tracker-worker.js', 'vendor/vision_bundle.js', `vendor/wasm/${wasm}.js`, `vendor/wasm/${wasm}.wasm`, 'vendor/face_landmarker.task'];
  const controller = new AbortController();
  const start = () => {
    for (const file of files) {
      // 读完响应体才会完整写入缓存；内容本身随即丢弃。
      fetch(base + file, { signal: controller.signal, priority: 'low' }).then(r => r.arrayBuffer()).catch(() => {});
    }
  };
  const idle = window.requestIdleCallback ?? (cb => setTimeout(cb, 1500));
  const cancelIdle = window.cancelIdleCallback ?? clearTimeout;
  const handle = idle(start, { timeout: 3000 });
  return () => { cancelIdle(handle); controller.abort(); };
}
