import { useRef, useState } from 'react';

const EMPTY_TRACK = { landmarks: null, smile: 0, jaw: 0, ms: 0, at: 0 };
export const emptyTrack = () => ({ ...EMPTY_TRACK });

/**
 * 摄像头 → 人脸识别流程：先等 <Camera> 出画，再启动 <FaceTracker>，最新识别结果写入 trackRef。
 * 返回的 cameraProps / trackerProps 直接交给两个组件；回调存在 ref 里，组件不会因重渲染重启。
 * handlers: { onReady, onError, onFaceLost }
 */
export function useFaceInput(active, handlers) {
  const videoRef = useRef(null);
  const trackRef = useRef(emptyTrack());
  const [started, setStarted] = useState(false);
  const h = useRef(handlers);
  h.current = handlers;
  // 摄像头关闭后回到「未出画」，下次开启重新走一遍流程。
  if (!active && started) setStarted(false);

  const cameraProps = {
    enabled: active,
    onStarted: () => setStarted(true),
    onError: (message) => h.current.onError(message),
  };
  const trackerProps = {
    videoRef,
    enabled: active && started,
    onReady: () => h.current.onReady(),
    onResult: (data) => {
      trackRef.current = { landmarks: data.landmarks, smile: data.smile, jaw: data.jaw, ms: data.ms, at: performance.now() };
      if (!data.landmarks) h.current.onFaceLost?.();
    },
    onError: (message) => h.current.onError(message + ' 演示模式仍可使用。'),
  };
  return { videoRef, trackRef, cameraProps, trackerProps };
}
