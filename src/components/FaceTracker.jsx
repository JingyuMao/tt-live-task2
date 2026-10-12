import { createTracker } from '../utils/tracker.js';
import { useEffect, useRef } from 'react';

/**
 * 人脸识别：在后台 Worker 中运行 MediaPipe Face Landmarker，不阻塞页面渲染。
 *
 * - Worker 位于 public/tracker-worker.js，模型与 WASM 位于 public/vendor/，全部同源、可离线。
 *   必须是 Classic Worker：MediaPipe 在 Worker 中用 importScripts 加载 WASM 加载器，Module Worker 不支持。
 * - 每帧缩到 480px 宽再识别，最多约 20 次/秒，同一时间只有一帧在途。
 * - onResult({ landmarks, smile, jaw, ms })：landmarks 为 468 个归一化关键点，无人脸时为 null。
 *
 * 不渲染任何界面。
 */
export default function FaceTracker({ videoRef, enabled, onReady, onResult, onError }) {
  const callbacks = useRef({ onReady, onResult, onError });
  callbacks.current = { onReady, onResult, onError };

  useEffect(() => {
    if (!enabled) return undefined;
    const cb = () => callbacks.current;
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      cb().onError?.('当前浏览器不支持后台识别，请使用新版 Chrome、Edge 或 Safari，或使用演示模式。');
      return undefined;
    }

    let disposed = false, ready = false, busy = false, ms = 0, lastInfer = 0, lastFrameTime = -1, raf = 0;
    let transport;
    try { transport = createTracker(); }
    catch (error) { cb().onError?.('后台识别无法启动：' + error.message); return; }
    const worker = transport.worker;
    const timeout = setTimeout(() => {
      if (!ready && !disposed) cb().onError?.('识别模型加载超时，请重试。演示模式仍可使用。');
    }, 60000);

    worker.onmessage = ({ data }) => {
      if (disposed) return;
      if (data.type === 'ready') { ready = true; clearTimeout(timeout); cb().onReady?.(); }
      else if (data.type === 'result') { busy = false; ms = data.ms; cb().onResult?.(data); }
      else if (data.type === 'error') cb().onError?.('识别加载或运行失败：' + data.message);
    };
    worker.onerror = () => { if (!disposed) cb().onError?.('后台识别不可用，请改用新版浏览器。'); };
    worker.postMessage(transport.init);

    const loop = async now => {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      // 推理间隔随实际耗时自适应；视频没有新帧时不重复识别。
      if (!ready || busy || document.hidden || !video || video.readyState < 2) return;
      if (now - lastInfer < Math.max(50, ms * 1.15) || video.currentTime === lastFrameTime) return;
      busy = true; lastInfer = now; lastFrameTime = video.currentTime;
      try {
        const bitmap = await createImageBitmap(video, {
          resizeWidth: 480,
          resizeHeight: Math.round((480 * video.videoHeight) / video.videoWidth),
        });
        if (disposed) { bitmap.close(); return; }
        worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
      } catch (error) {
        busy = false;
        if (!disposed) cb().onError?.('无法读取摄像头帧：' + error.message);
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      worker.terminate();
      transport.dispose();
    };
  }, [enabled, videoRef]);

  return null;
}
