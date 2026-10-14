/** Model lifetime is independent of camera permission and frame delivery. */
export class TrackerSession {
  constructor(create, callbacks, timeoutMs = 60000) {
    this.create = create;
    this.callbacks = callbacks;
    this.timeoutMs = timeoutMs;
    this.phase = 'idle';
    this.enabled = false;
    this.epoch = 0;
    this.ms = 0;
    this.pending = null;
  }
  prepare() {
    if (this.disposed || this.phase === 'loading' || this.phase === 'ready') return;
    this.phase = 'loading';
    this.callbacks.onPreparation?.('loading');
    try {
      const transport = this.create();
      this.transport = transport;
      const worker = transport.worker;
      const fail = message => {
        if (this.disposed || this.transport !== transport) return;
        this.release();
        this.phase = 'error';
        this.callbacks.onPreparation?.('error');
        if (this.enabled) this.callbacks.onError?.(message);
      };
      this.timer = setTimeout(() => fail('识别模型加载超时，请重新开启摄像头重试。'), this.timeoutMs);
      worker.onerror = () => fail('后台识别不可用，请重新开启摄像头重试或使用新版浏览器。');
      worker.onmessage = ({ data }) => {
        if (this.disposed || this.transport !== transport) return;
        if (data.type === 'ready') {
          clearTimeout(this.timer);
          this.phase = 'ready';
          this.callbacks.onPreparation?.('ready');
          if (this.enabled) this.callbacks.onReady?.();
        } else if (data.type === 'result') {
          const pending = this.pending;
          this.pending = null;
          this.ms = data.ms;
          if (this.enabled && pending?.epoch === this.epoch) this.callbacks.onResult?.(data);
        } else if (data.type === 'error') fail('识别加载或运行失败：' + data.message);
      };
      worker.postMessage(transport.init);
    } catch (error) {
      this.release();
      this.phase = 'error';
      this.callbacks.onPreparation?.('error');
      if (this.enabled) this.callbacks.onError?.('后台识别无法启动：' + error.message);
    }
  }
  setEnabled(enabled) {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    this.epoch++;
    if (enabled) {
      if (this.phase === 'ready') this.callbacks.onReady?.();
      else this.prepare();
    }
  }
  canSend() { return !this.disposed && this.enabled && this.phase === 'ready' && !this.pending; }
  sendFrame(bitmap, timestamp, epoch) {
    if (!this.canSend() || epoch !== this.epoch) { bitmap.close(); return; }
    this.pending = { epoch };
    try { this.transport.worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]); }
    catch (error) { this.pending = null; bitmap.close(); this.callbacks.onError?.('无法读取摄像头帧：' + error.message); }
  }
  release() {
    clearTimeout(this.timer);
    this.transport?.worker.terminate();
    this.transport?.dispose();
    this.transport = null;
    this.pending = null;
  }
  dispose() { this.disposed = true; this.epoch++; this.release(); }
}
