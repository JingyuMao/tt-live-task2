// 特效声音：每个特效由一条或多条音轨组成，参数由设计师设定，直播用户不可调整。
// 音频文件放在 public/assets/audio/。数值依据 2026-10-11 对文件的实测：
//   星雨特效音乐.mp3  4.0 秒，特效音与配乐已合成一条；0.16 秒起声，响到结尾（RMS 约 -18 dB）
//   烟花-特效.mp3     5.0 秒，0.2–0.4 / 1.7–1.9 / 2.8 / 3.4 秒处有爆响，约 3.9 秒结束（RMS 约 -19 dB）
//   烟花-BG2.mp3      5.0 秒，比烟花特效音轻约 10 dB
export const AUDIO = {
  master: 0.9,          // 总音量
  cut: 0.15,            // 同一特效重新开始时，旧声音的快速淡出（秒）
  rain: {
    tracks: [
      { file: '星雨特效音乐.mp3', duration: 4.02, gain: 0.6, start: 0.15, delay: 0, fadeIn: 0.05 }, // 跳过开头 0.15 秒静音；比烟花略轻
    ],
    fadeOut: null,      // 星雨自然结束时不截断：音乐播完整段，与画面淡出同时结束（RAIN_DURATION_MS 按此设定）
  },
  fireworks: {
    tracks: [
      { file: '烟花-特效.mp3', gain: 0.8, start: 0, delay: 0.1, fadeIn: 0.01 }, // 第一声爆响对齐第一朵绽放（约 0.4 秒）
      { file: '烟花-BG2.mp3', gain: 1.0, start: 0, delay: 0, fadeIn: 0.05 },
    ],
    fadeOut: 0.6,       // 整组烟花结束时淡出余音
  },
};

// 所有需要加载（以及单文件版本需要内嵌）的音频文件。
export const AUDIO_FILES = [...new Set(['rain', 'fireworks'].flatMap(effect => AUDIO[effect].tracks.map(t => t.file)))];

// 单文件版本（TT直播间特效.html）会把音频以 base64 内嵌在页面中，双击打开时无法读取外部文件。
async function readSound(file) {
  const embedded = document.getElementById('ew-audio-' + file);
  if (embedded) return (await fetch('data:audio/mpeg;base64,' + embedded.textContent.trim())).arrayBuffer();
  const base = import.meta.env?.BASE_URL ?? './';
  const response = await fetch(`${base}assets/audio/${encodeURIComponent(file)}`);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return response.arrayBuffer();
}

export class EffectAudio {
  constructor(config = AUDIO) {
    this.config = config;
    this.ctx = null;
    this.generation = 0;
    this.buffers = new Map();
    this.voices = { rain: [], fireworks: [] };
  }

  // 浏览器要求用户先点击页面才能出声：在第一次点击时创建并恢复音频环境，同时开始解码音频。
  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.output = this.ctx.createGain();
      this.output.gain.value = this.config.master;
      this.output.connect(this.ctx.destination);
      this.ready = this.load();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  async load() {
    const files = [...new Set(['rain', 'fireworks'].flatMap(effect => this.config[effect].tracks.map(t => t.file)))];
    const ctx = this.ctx;
    await Promise.all(files.map(async file => {
      try { const buffer = await ctx.decodeAudioData(await readSound(file)); if (this.ctx === ctx) this.buffers.set(file, buffer); }
      catch (error) { console.warn('特效音频加载失败：', error.message); }
    }));
  }

  // 播放一个特效的声音。
  async play(effect) {
    if (!this.ctx) return;
    const token = ++this.generation, ctx = this.ctx, requestedAt = ctx.currentTime;
    // 特效互斥，新特效开始时另一个已结束；其余音只剩淡出尾巴，让它自然消失。
    this.stop(effect, this.config.cut);
    await this.ready;
    if (token !== this.generation || ctx !== this.ctx) return;
    const elapsed = ctx.currentTime - requestedAt;
    const now = this.ctx.currentTime;
    for (const spec of this.config[effect].tracks) {
      const buffer = this.buffers.get(spec.file);
      if (!buffer) continue;
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      source.buffer = buffer;
      source.connect(gain).connect(this.output);
      const at = now + Math.max(0, spec.delay - elapsed);
      const offset = spec.start + Math.max(0, elapsed - spec.delay);
      if (offset >= buffer.duration) { source.disconnect(); gain.disconnect(); continue; }
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(spec.gain, at + spec.fadeIn);
      source.start(at, offset);
      const voice = { source, gain };
      source.onended = () => { source.disconnect(); gain.disconnect(); this.voices[effect] = this.voices[effect].filter(v => v !== voice); };
      this.voices[effect].push(voice);
    }
  }

  // 特效自然结束：按设定时长淡出仍在播放的声音；fadeOut 为 null 时让音轨自然播完。
  release(effect) {
    this.generation++;
    const fade = this.config[effect].fadeOut;
    if (fade != null) this.stop(effect, fade);
  }

  stop(effect, fade = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const { source, gain } of this.voices[effect]) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fade);
      try { source.stop(now + fade + 0.02); } catch { /* 已停止 */ }
    }
    this.voices[effect] = [];
  }

  stopAll() { this.generation++; this.stop('rain'); this.stop('fireworks'); }

  dispose() {
    this.stopAll();
    const ctx = this.ctx; this.ctx = null;
    this.buffers.clear(); this.ready = null;
    this.output?.disconnect(); this.output = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }
}
