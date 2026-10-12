import { useSyncExternalStore } from 'react';

/**
 * 界面数值（粒子数、FPS 等）的小型外部 store。
 * 帧循环每 250 ms 写入一次；只有订阅它的小组件会重绘，工作台主体不会随数值刷新而重新渲染。
 * 数值没有变化时不通知订阅者。
 */
export function createHudStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (Object.keys(next).every(k => next[k] === value[k])) return;
      value = next;
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// select 应返回原始值或 store 中的同一对象，保证快照稳定。
export function useHud(store, select = v => v) {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
