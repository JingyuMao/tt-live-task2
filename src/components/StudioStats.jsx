import React from 'react';
import { useHud } from '../utils/hudStore.js';

// 只订阅需要的数值：人脸锁定状态变化时才重绘这一行。
export function ModeLabel({ mode, hud }) {
  const face = useHud(hud, v => v.face);
  const label = { idle: '待机 · 摄像头未开启', loading: '正在准备摄像头…', camera: face ? '实时 · 人脸已锁定' : '实时 · 寻找人脸' }[mode];
  return <span>{label}</span>;
}
