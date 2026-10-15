// 区分平静、微笑和大笑。纯逻辑，无 DOM，可直接单元测试。
//
// 输入是 MediaPipe 的两个 blendshape 分数（0–1）：
//   smile = (mouthSmileLeft + mouthSmileRight) / 2
//   jaw   = jawOpen
// 只张嘴（不笑）不会被当成大笑。

// 触发阈值由设计师设定，直播用户不可调整。修改效果时只改这里。
// 分数均为 0–1；「保持」门槛低于「进入」门槛，避免在阈值附近来回跳。
export const THRESHOLDS = {
  smileEnter: 0.46,      // 微笑：平静时，微笑分超过此值进入微笑
  smileHold: 0.37,       // 微笑：已在笑时，微笑分高于此值保持
  laughSmileEnter: 0.51, // 大笑：平静时，微笑分需超过此值……
  laughSmileHold: 0.42,  //       已在笑时的微笑分门槛
  laughJawEnter: 0.28,   // ……且张嘴分超过此值才算大笑
  laughJawHold: 0.22,    //       已在大笑时的张嘴分门槛
  smoothing: 0.38,       // 平滑：每次采样新分数所占比例（越小越稳、越慢）
  stableMs: 180,         // 新表情需连续保持的时长
  burstCooldownMs: 1450, // 持续大笑时两次烟花的最短间隔
};

export class ExpressionGate {
  constructor(thresholds = THRESHOLDS) { this.t = thresholds; this.reset(); }

  reset() {
    this.smile = 0;
    this.jaw = 0;
    this.state = 'neutral';
    this.candidate = 'neutral';
    this.since = 0;
    this.lastBurst = -Infinity;
  }

  /**
   * @param {number} smile  原始微笑分数
   * @param {number} jaw    原始张嘴分数
   * @param {number} now    毫秒时间戳
   * @returns {{state:'neutral'|'smile'|'laugh', burst:boolean}}
   */
  update(smile, jaw, now) {
    const t = this.t;
    // 指数平滑，过滤识别抖动。
    this.smile += (smile - this.smile) * t.smoothing;
    this.jaw += (jaw - this.jaw) * t.smoothing;

    const smiling = this.state !== 'neutral';
    let next = this.smile > (smiling ? t.smileHold : t.smileEnter) ? 'smile' : 'neutral';
    const laughSmile = smiling ? t.laughSmileHold : t.laughSmileEnter;
    const laughJaw = this.state === 'laugh' ? t.laughJawHold : t.laughJawEnter;
    if (this.smile > laughSmile && this.jaw > laughJaw) next = 'laugh';

    // 新状态需稳定一段时间才生效，短暂误触被忽略。
    if (next !== this.candidate) { this.candidate = next; this.since = now; }
    if (now - this.since > t.stableMs) this.state = next;

    const burst = this.state === 'laugh' && now - this.lastBurst > t.burstCooldownMs;
    if (burst) this.lastBurst = now;
    return { state: this.state, burst };
  }
}

// 边沿触发的定长特效：由平静进入 trigger 状态时开始一次播放。
// 保持该表情不会延长；要再次播放，需先回到平静再进入。
export class EffectTimer {
  constructor(duration) { this.duration = duration; this.reset(); }
  reset() { this.until = -Infinity; this.prev = 'neutral'; }
  rearm() { this.until = -Infinity; this.prev = 'neutral'; }
  update(state, now, trigger = 'smile') {
    if (state === trigger && this.prev === 'neutral' && now >= this.until) this.until = now + this.duration;
    this.prev = state;
  }
  active(now) { return now < this.until; }
}

// 星雨触发窗口。之后画面约 0.8 秒淡到看不见（再约 0.4 秒余光完全消失），
// 看得见的部分约 4.7 秒，与星雨音乐的播放时长一致
// （见 utils/audio.js 的 AUDIO.rain；tests/sync.test.mjs 校验两者同步，换音乐时需一起调整）。
export const RAIN_DURATION_MS = 3900;
