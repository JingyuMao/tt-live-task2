import { useCallback, useRef, useState } from 'react';
import { RAIN_DURATION_MS } from '../utils/expression.js';
import { useFaceInput } from './useFaceInput.js';
import { useDemoHead } from './useDemoHead.js';
import { useEffectLoop } from './useEffectLoop.js';

/**
 * 工作台状态：模式切换、状态文案、设置与弹窗。
 * 摄像头/识别流程 → useFaceInput；演示头部 → useDemoHead；帧循环与声音 → useEffectLoop。
 */
export function useStudio() {
  // mode: idle 待机 | loading 正在开启摄像头 | camera 实时识别 | demo 演示模式
  const [mode, setMode] = useState('idle');
  const [status, setStatus] = useState('影像仅在设备内处理，不录制、不上传。');
  const [demoExpression, setDemoExpression] = useState('neutral');
  const [showOutline, setShowOutline] = useState(false);
  const [gentle, setGentle] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  const stageRef = useRef(null);
  const settingsRef = useRef(null);
  const helpRef = useRef(null);
  const overlayRef = useRef(null);
  const rainRef = useRef(null);
  const fireworksRef = useRef(null);

  // 动画循环读取最新设置，而不随每次渲染重启。
  const settings = useRef({});
  settings.current = { mode, demoExpression, showOutline, gentle };

  const cameraOn = mode === 'loading' || mode === 'camera';
  const face = useFaceInput(cameraOn, {
    onReady: () => { setMode('camera'); setStatus('识别已就绪。先自然微笑，再张嘴大笑。'); },
    onError: (message) => stop(message),
    onFaceLost: () => loop.gate.current.reset(),
  });
  const demo = useDemoHead(stageRef, mode === 'demo');
  const loop = useEffectLoop({
    overlayRef, rainRef, fireworksRef, settings,
    videoRef: face.videoRef, trackRef: face.trackRef, headRef: demo.headRef,
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
    setStatus('正在请求摄像头并载入识别模型…');
  };

  const selectDemoExpression = (id) => {
    setDemoExpression(id);
    if (id === 'smile') loop.rearmRain();
  };

  const startDemo = () => {
    stop();
    setMode('demo');
    selectDemoExpression('neutral');
    setStatus('演示模式使用模拟表情与头部，不代表摄像头识别。选择表情，拖动画面移动头部。');
  };

  // 预览区全屏
  const toggleFullscreen = () => {
    const stage = stageRef.current;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => setStatus('当前浏览器无法进入全屏。'));
    else setStatus('当前浏览器不支持全屏预览。');
  };
  const openSettings = () => settingsRef.current?.showModal();
  const openHelp = () => helpRef.current?.showModal();

  const modeLabel = { idle: '待机 · 摄像头未开启', loading: '正在准备摄像头…', camera: hud.face ? '实时 · 人脸已锁定' : '实时 · 寻找人脸', demo: '演示 · 模拟表情' }[mode];
  const hint = hud.effect === 'fireworks' ? '烟花绽放 · 移动头部接住烟花'
    : hud.effect === 'rain' ? `微笑星雨 · 持续 ${RAIN_DURATION_MS / 1000} 秒`
    : mode === 'demo' ? '选择右侧表情 · 拖动画面移动头部'
    : hud.face ? '试着微笑，或张嘴大笑' : '请将面部置于画面中央';
  const unavailable = '本地预览暂不提供此功能';

  const { onPointerDown, onPointerMove, onPointerUp, onKeyDown } = demo;
  return {
    mode, status, setStatus, demoExpression, showOutline, setShowOutline, gentle, setGentle, hud,
    stageRef, settingsRef, helpRef, overlayRef, rainRef, fireworksRef, face,
    toggleCamera, startDemo, selectDemoExpression, onPointerDown, onPointerMove, onPointerUp, onKeyDown,
    toggleFullscreen, openSettings, openHelp, modeLabel, hint, cameraOn, unavailable,
  };
}
