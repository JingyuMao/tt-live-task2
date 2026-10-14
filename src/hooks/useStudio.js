import { useCallback, useRef, useState } from 'react';
import { useFaceInput } from './useFaceInput.js';
import { useEffectLoop } from './useEffectLoop.js';

// 碰撞轮廓不显示；系统开启「减少动态效果」时使用柔和特效。均为设计设定，用户不可调整。
const SHOW_OUTLINE = false;
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * 工作台状态：摄像头开关与状态文案。界面中只有摄像头开关可交互。
 * 摄像头/识别流程 → useFaceInput；帧循环与声音 → useEffectLoop。
 */
export function useStudio() {
  // mode: idle 待机 | loading 正在开启摄像头 | camera 实时识别
  const [mode, setMode] = useState('idle');
  const [status, setStatus] = useState('影像仅在设备内处理，不录制、不上传。');
  const [gentle] = useState(prefersReducedMotion);

  const overlayRef = useRef(null);
  const rainRef = useRef(null);
  const fireworksRef = useRef(null);

  // 动画循环读取最新设置，而不随每次渲染重启。
  const settings = useRef({});
  settings.current = { mode, showOutline: SHOW_OUTLINE, gentle };

  const cameraOn = mode === 'loading' || mode === 'camera';
  const face = useFaceInput(cameraOn, {
    onReady: () => { setMode('camera'); setStatus('识别已就绪。'); },
    onError: (message) => stop(message),
    onFaceLost: () => loop.gate.current.reset(),
  });
  const loop = useEffectLoop({
    overlayRef, rainRef, fireworksRef, settings,
    videoRef: face.videoRef, trackRef: face.trackRef,
    onPageHide: () => stop(),
  });
  const { hud, resetEffects } = loop;

  const stop = useCallback((message) => {
    setMode('idle');
    resetEffects();
    if (message) setStatus(message);
  }, [resetEffects]);

  const toggleCamera = () => {
    if (cameraOn) { stop('摄像头已关闭。影像未保存。'); return; }
    resetEffects();
    setMode('loading');
    setStatus(face.preparation === 'ready' ? '识别已就绪，正在请求摄像头…' : '正在请求摄像头，等待识别准备完成…');
  };

  return { mode, status, hud, overlayRef, rainRef, fireworksRef, face, toggleCamera, cameraOn };
}
