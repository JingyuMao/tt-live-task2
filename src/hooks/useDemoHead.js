import { useRef } from 'react';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const STEP = 0.035;
const KEYS = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] };
const place = (x, y) => ({ x: clamp(x, 0.18, 0.82), y: clamp(y, 0.25, 0.8) });

// 演示模式：拖动或方向键移动模拟头部。头部位置为画面比例坐标，存在 ref 中供主循环读取。
export function useDemoHead(stageRef, enabled) {
  const headRef = useRef({ x: 0.5, y: 0.56 });
  const dragging = useRef(false);

  const moveTo = (event) => {
    const rect = stageRef.current.getBoundingClientRect();
    headRef.current = place((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  };
  const onPointerDown = (e) => { if (!enabled) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); moveTo(e); };
  const onPointerMove = (e) => { if (dragging.current) moveTo(e); };
  const onPointerUp = () => { dragging.current = false; };
  const onKeyDown = (e) => {
    const step = enabled && KEYS[e.key];
    if (!step) return;
    e.preventDefault();
    const h = headRef.current;
    headRef.current = place(h.x + step[0], h.y + step[1]);
  };
  return { headRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown };
}
