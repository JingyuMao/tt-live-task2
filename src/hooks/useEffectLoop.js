import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpressionGate } from '../utils/expression.js';
import { faceOutline, ellipseOutline } from '../utils/collision.js';
import { EffectAudio } from '../utils/audio.js';
import { ExclusiveEffects } from '../engines/effects.js';
import { emptyTrack } from './useFaceInput.js';

const LOST_FACE_MS = 450;

/**
 * 共享帧循环：头部轮廓 → 表情判定 → 特效互斥调度 → 声音同步 → 绘制 → 界面数值。
 * settings 是 ref（{ mode, demoExpression, showOutline, gentle }），循环读取最新值而不重启。
 */
export function useEffectLoop({ overlayRef, rainRef, fireworksRef, videoRef, trackRef, headRef, settings, onPageHide }) {
  const [hud, setHud] = useState({ smile: 0, jaw: 0, particles: 0, collisions: 0, fps: 0, ms: 0, effect: 'none', face: false });
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

  // 再次点「微笑」可重播星雨；烟花播放中不会排队。
  const rearmRain = useCallback(() => effects.current?.rearmRain(), []);

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

    let raf = 0, last = 0, lastSample = 0, lastHud = 0, frameMs = 16, expression = 'neutral';
    const controller = new ExclusiveEffects(rainRef.current, fireworksRef.current);
    effects.current = controller;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      const dt = now - (last || now); last = now;
      frameMs = frameMs * 0.95 + Math.min(dt, 100) * 0.05;
      const s = settings.current, { w, h } = size, track = trackRef.current, video = videoRef.current;
      const rain = rainRef.current, fireworks = fireworksRef.current;
      if (!rain || !fireworks) return;

      // 1. 头部轮廓（碰撞体）
      if (s.mode === 'demo') {
        const rx = Math.min(w * 0.16, 95);
        polyRef.current = ellipseOutline(headRef.current.x * w, headRef.current.y * h, rx, rx * 1.32);
      } else if (s.mode === 'camera' && track.landmarks && now - track.at < LOST_FACE_MS && video?.videoWidth) {
        polyRef.current = faceOutline(track.landmarks, video.videoWidth, video.videoHeight, w, h);
      } else polyRef.current = [];
      const poly = polyRef.current;

      let burst = false;
      // 2. 表情按识别频率采样（每 50 ms），而不是按屏幕刷新率。
      if (now - lastSample > 50) {
        lastSample = now;
        let smile = track.smile, jaw = track.jaw;
        if (s.mode === 'demo') { smile = s.demoExpression === 'neutral' ? 0 : 0.9; jaw = s.demoExpression === 'laugh' ? 0.7 : 0.03; }
        if (poly.length) {
          const result = gate.current.update(smile, jaw, now);
          expression = result.state; burst = result.burst;
        } else { expression = 'neutral'; gate.current.reset(); }
      }

      // 被互斥挡住的大笑不占用烟花冷却：特效结束时仍在大笑，就在下一次采样立即接上。
      if (burst && controller.busy(now)) gate.current.lastBurst = -Infinity;

      // 3. 同一循环推进两个引擎，再让声音跟随同一生命周期。
      controller.update(Math.min(dt / 1000, .033), expression, now, {
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

      // 4. 轮廓与演示头像
      ctx.clearRect(0, 0, w, h);
      if (poly.length) {
        ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
        if (s.mode === 'demo') { ctx.fillStyle = '#334833'; ctx.fill(); }
        if (s.showOutline) { ctx.strokeStyle = '#d4f88ca0'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]); }
        if (s.mode === 'demo') {
          const cx = headRef.current.x * w, cy = headRef.current.y * h, r = Math.min(w * 0.16, 95);
          ctx.fillStyle = '#d4f88c'; ctx.beginPath(); ctx.arc(cx - r * 0.33, cy - r * 0.18, 3, 0, 7); ctx.arc(cx + r * 0.33, cy - r * 0.18, 3, 0, 7); ctx.fill();
          ctx.beginPath();
          if (s.demoExpression === 'laugh') ctx.ellipse(cx, cy + r * 0.4, r * 0.26, r * 0.3, 0, 0, 7);
          else if (s.demoExpression === 'smile') ctx.arc(cx, cy + r * 0.18, r * 0.32, 0, Math.PI);
          else { ctx.moveTo(cx - r * 0.2, cy + r * 0.35); ctx.lineTo(cx + r * 0.2, cy + r * 0.35); }
          ctx.strokeStyle = '#d4f88c'; ctx.lineWidth = 3; ctx.stroke();
        }
      }

      controller.draw(ctx, w, h, s.gentle);

      // 5. 界面数值每 250 ms 更新一次，避免每帧触发 React 渲染。
      if (now - lastHud > 250) {
        lastHud = now;
        setHud({
          smile: gate.current.smile, jaw: gate.current.jaw,
          particles: rain.active + fireworks.active, collisions: fireworks.collisions,
          fps: Math.round(1000 / Math.max(frameMs, 1)), ms: Math.round(track.ms),
          effect: controller.fireworksBusy() ? 'fireworks' : rain.level > 0 ? 'rain' : 'none', face: poly.length > 0,
        });
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
  }, [overlayRef, rainRef, fireworksRef, videoRef, trackRef, headRef, settings, resetEffects]);

  return { hud, gate, resetEffects, rearmRain };
}
