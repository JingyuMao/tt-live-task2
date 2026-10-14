import { useEffect, useRef } from 'react';
import { createTracker } from '../utils/tracker.js';
import { TrackerSession } from '../utils/trackerSession.js';

// Prepare the Worker/model on mount, without opening the camera. Keep it warm between camera sessions.
export default function FaceTracker({ videoRef, enabled, onPreparation, onReady, onResult, onError }) {
  const callbacks = useRef({ onPreparation, onReady, onResult, onError });
  callbacks.current = { onPreparation, onReady, onResult, onError };
  const session = useRef(null);

  useEffect(() => {
    const tracker = new TrackerSession(() => {
      if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
        throw new Error('当前浏览器不支持后台识别，请使用新版 Chrome、Edge 或 Safari。');
      }
      return createTracker();
    }, {
      onPreparation: phase => callbacks.current.onPreparation?.(phase),
      onReady: () => callbacks.current.onReady?.(),
      onResult: data => callbacks.current.onResult?.(data),
      onError: message => callbacks.current.onError?.(message),
    });
    session.current = tracker;
    // Yield one task to render the page; StrictMode's discarded mount will not download twice.
    const start = setTimeout(() => tracker.prepare(), 0);
    const release = () => tracker.dispose();
    window.addEventListener('pagehide', release);
    const restore = event => { if (event.persisted) { tracker.disposed = false; tracker.enabled = false; tracker.phase = 'idle'; tracker.prepare(); } };
    window.addEventListener('pageshow', restore);
    return () => {
      clearTimeout(start);
      tracker.dispose();
      session.current = null;
      window.removeEventListener('pagehide', release);
      window.removeEventListener('pageshow', restore);
    };
  }, []);

  useEffect(() => {
    const tracker = session.current;
    tracker.setEnabled(enabled);
    if (!enabled) return;
    let disposed = false, preparing = false, raf = 0, lastInfer = 0, lastFrameTime = -1;
    const loop = async now => {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      if (!tracker.canSend() || preparing || document.hidden || !video || video.readyState < 2) return;
      if (now - lastInfer < Math.max(50, tracker.ms * 1.15) || video.currentTime === lastFrameTime) return;
      preparing = true; lastInfer = now; lastFrameTime = video.currentTime;
      const epoch = tracker.epoch;
      try {
        const bitmap = await createImageBitmap(video, {
          resizeWidth: 480, resizeHeight: Math.round(480 * video.videoHeight / video.videoWidth),
        });
        if (disposed) bitmap.close();
        else tracker.sendFrame(bitmap, now, epoch);
      } catch (error) {
        if (!disposed) callbacks.current.onError?.('无法读取摄像头帧：' + error.message);
      } finally { preparing = false; }
    };
    raf = requestAnimationFrame(loop);
    return () => { disposed = true; cancelAnimationFrame(raf); tracker.setEnabled(false); };
  }, [enabled, videoRef]);
  return null;
}
