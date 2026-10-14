import { useCallback, useEffect, useRef } from 'react';
import { ExpressionGate } from '../utils/expression.js';
import { faceOutline } from '../utils/collision.js';
import { EffectAudio } from '../utils/audio.js';
import { ExclusiveEffects } from '../engines/effects.js';
import { emptyTrack } from './useFaceInput.js';
import { createHudStore } from '../utils/hudStore.js';

const LOST_FACE_MS = 450;
// 特效动画帧率上限（与 TikTok Effect House 的 30 FPS 上限一致）。粒子运动按真实时间计算，降帧不改变速度与时长。
const MAX_FPS = 30;
const FRAME_MS = 1000 / MAX_FPS;
// 允许 2 ms 抖动：60 Hz 屏每 2 帧、120 Hz 屏每 4 帧画一次，避免偶尔被跳成 20 FPS。
const FRAME_SLACK_MS = 2;

/**
 * 共享帧循环：头部轮廓 → 表情判定 → 特效互斥调度 → 声音同步 → 绘制 → 界面数值。
 * settings 是 ref（{ mode, showOutline, gentle }），循环读取最新值而不重启。
 */
export function useEffectLoop({ overlayRef, rainRef, fireworksRef, videoRef, trackRef, settings, onPageHide }) {
  // 界面数值不走 React state：写入外部 store，只有订阅的小组件重绘。
  const hud = useRef(null);
  if (!hud.current) hud.current = createHudStore({ face: false });
  const gate = useRef(new ExpressionGate());
  const effects = useRef(null);
  const polyRef = useRef([]);
  const audioState = useRef({ rainUntil: -Infinity, raining: false, fireworks: false });
  const sound = useRef(new EffectAudio());
  const pageHide = useRef(onPageHide);
  pageHide.current = onPageHide;

  const resetEffects = useCallback(() => {
    gate.current.reset();
    effects.current?.reset();
    audioState.current = { rainUntil: -Infinity, raining: false, fireworks: false };
    sound.current.stopAll();
    rainRef.current?.clear();
    fireworksRef.current?.clear();
    polyRef.current = [];
    trackRef.current = emptyTrack();
  }, [rainRef, fireworksRef, trackRef]);

  useEffect(() => {
    const canvas = overlayRef.current, ctx = canvas.getContext('2d'), size = { w: 1, h: 1 };
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      size.w = r.width || 1; size.h = r.height || 1;
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(size.w * d); canvas.height = Math.round(size.h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const ro = new ResizeObserver(fit); ro.observe(canvas); fit();

    let raf = 0, last = 0, lastSample = 0, lastHud = 0, expression = 'neutral';
    const controller = new ExclusiveEffects(rainRef.current, fireworksRef.current);
    effects.current = controller;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      if (last && now - last < FRAME_MS - FRAME_SLACK_MS) return;
      const dt = now - (last || now); last = now;
      const s = settings.current, { w, h } = size, track = trackRef.current, video = videoRef.current;
      const rain = rainRef.current, fireworks = fireworksRef.current;
      if (!rain || !fireworks) return;

      // 1. 头部轮廓（碰撞体）
      if (s.mode === 'camera' && track.landmarks && now - track.at < LOST_FACE_MS && video?.videoWidth) {
        polyRef.current = faceOutline(track.landmarks, video.videoWidth, video.videoHeight, w, h);
      } else polyRef.current = [];
      const poly = polyRef.current;

      let burst = false;
      // 2. 表情按识别频率采样（每 50 ms），而不是按屏幕刷新率。
      if (now - lastSample > 50) {
        lastSample = now;
        if (poly.length) {
          const result = gate.current.update(track.smile, track.jaw, now);
          expression = result.state; burst = result.burst;
        } else { expression = 'neutral'; gate.current.reset(); }
      }

      // 被互斥挡住的大笑不占用烟花冷却：特效结束时仍在大笑，就在下一次采样立即接上。
      if (burst && controller.busy(now)) gate.current.lastBurst = -Infinity;

      // 3. 同一循环推进两个引擎，再让声音跟随同一生命周期。
      controller.update(Math.min(dt / 1000, .05), expression, now, {
        burst, width: w, height: h, gentle: s.gentle, poly,
      });
      const previous = audioState.current;
      const fireworksBusy = controller.fireworksBusy();
      const raining = !fireworksBusy && controller.timer.active(now);
      if (fireworksBusy && !previous.fireworks) sound.current.play('fireworks');
      if (!fireworksBusy && previous.fireworks) sound.current.release('fireworks');
      if (raining && controller.timer.until !== previous.rainUntil) sound.current.play('rain');
      else if (!raining && previous.raining && !fireworksBusy) sound.current.release('rain');
      audioState.current = { rainUntil: controller.timer.until, raining, fireworks: fireworksBusy };

      // 4. 碰撞轮廓（设计开关，默认不显示）
      ctx.clearRect(0, 0, w, h);
      if (poly.length && s.showOutline) {
        ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
        ctx.strokeStyle = '#d4f88ca0'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
      }

      controller.draw(ctx, w, h, s.gentle);

      // 5. 人脸锁定状态每 250 ms 写入一次；状态不变时不触发 React 渲染。
      if (now - lastHud > 250) {
        lastHud = now;
        hud.current.set({ face: poly.length > 0 });
      }
    };
    raf = requestAnimationFrame(loop);

    // 页面切到后台：清空特效与表情状态，回来后重新判定。
    const onVisibility = () => { if (document.hidden) resetEffects(); };
    // 浏览器要求先有用户操作才能出声：任意点击或按键时解锁音频。
    const unlock = () => sound.current.unlock();
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', unlock, true);
    document.addEventListener('visibilitychange', onVisibility);
    const onHide = () => pageHide.current?.();
    window.addEventListener('pagehide', onHide);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('click', unlock, true);
      window.removeEventListener('pagehide', onHide);
      controller.reset();
      effects.current = null;
      sound.current.dispose();
    };
  }, [overlayRef, rainRef, fireworksRef, videoRef, trackRef, settings, resetEffects]);

  return { hud: hud.current, gate, resetEffects };
}
