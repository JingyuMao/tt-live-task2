import React from 'react';
import { useStudio } from './hooks/useStudio.js';
import Camera from './components/Camera.jsx';
import FaceTracker from './components/FaceTracker.jsx';
import RainEffect from './components/RainEffect.jsx';
import FireworkEffect from './components/FireworkEffect.jsx';
import { RAIN_DURATION_MS } from './utils/expression.js';

const EXPRESSIONS = [
  { id: 'neutral', label: '平静' },
  { id: 'smile', label: '微笑 · 星雨' },
  { id: 'laugh', label: '大笑 · 烟花' },
];

// 工作台界面的线条图标。
function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const I = {
  home: <Icon><path d="m2 10 10-8 10 8-3 1v10H5V11Zm8 11v-7h4v7" /></Icon>,
  bell: <Icon><path d="M5 16V9a7 7 0 0 1 14 0v7l2 2H3Zm5 5h4" /></Icon>,
  help: <Icon><circle cx="12" cy="12" r="10" /><path d="M9 8a3 3 0 1 1 4 3v3m0 3v1" /></Icon>,
  sliders: <Icon><path d="M3 6h18M3 12h18M3 18h18" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></Icon>,
  user: <Icon><circle cx="12" cy="7" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3" /></Icon>,
  phone: <Icon><rect x="7" y="2" width="10" height="20" rx="2" /></Icon>,
  monitor: <Icon><rect x="2" y="5" width="20" height="13" rx="2" /><path d="M8 22h8m-4-4v4" /></Icon>,
  camera: <Icon><rect x="3" y="6" width="18" height="14" rx="3" /><path d="m8 6 2-3h4l2 3" /><circle cx="12" cy="13" r="4" /></Icon>,
  sparkle: <Icon><path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z" /></Icon>,
  gift: <Icon><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13" /><path d="M12 8C2 8 6-2 12 8c6-10 10 0 0 0Z" /></Icon>,
  target: <Icon><circle cx="11" cy="13" r="8" /><circle cx="11" cy="13" r="4" /><path d="m11 13 10-10m-5 0h5v5" /></Icon>,
  heart: <Icon><path d="M12 21 3 12C-3 4 8-1 12 6c4-7 15-2 9 6Z" /></Icon>,
  book: <Icon><path d="M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Zm0 0v16" /></Icon>,
  speaker: <Icon><path d="M3 9h4l5-5v16l-5-5H3Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16" /></Icon>,
  mic: <Icon><rect x="8" y="2" width="8" height="13" rx="4" /><path d="M4 10v2a8 8 0 0 0 16 0v-2m-8 10v4m-4 0h8" /></Icon>,
};

export default function App() {
  const { mode, status, setStatus, demoExpression, showOutline, setShowOutline, gentle, setGentle, hud, stageRef, settingsRef, helpRef, overlayRef, rainRef, fireworksRef, face, toggleCamera, startDemo, selectDemoExpression, onPointerDown, onPointerMove, onPointerUp, onKeyDown, toggleFullscreen, openSettings, openHelp, modeLabel, hint, cameraOn, unavailable } = useStudio();
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="traffic" aria-hidden="true"><i /><i /><i /></div>
          <span className="brand-logo">♪</span>
          <strong>TikTok LIVE Studio</strong>
        </div>
        <div className="stream-title">Lets Go LIVE! <span aria-hidden="true">✎　↗</span></div>
        <nav aria-label="工作台">
          <span className="nav-label">{I.home}直播中心</span>
          <button className="icon-button" aria-label="通知" onClick={() => setStatus('当前没有新通知')}>{I.bell}</button>
          <button className="icon-button" aria-label="使用帮助" onClick={openHelp}>{I.help}</button>
          <button className="icon-button" aria-label="互动设置" onClick={openSettings}>{I.sliders}</button>
          <span className="account"><span className="avatar">{I.user}</span>本地预览</span>
        </nav>
      </header>

      <main className="studio">
        <aside className="left-rail">
          <section className="panel sources">
            <h2>移动端视图 <span>⌄</span></h2>
            <div className="orientation">
              <span className="selected" title="当前固定为竖屏">{I.phone}</span>
              <span>{I.monitor}<small>9:19.5</small></span>
            </div>
            <div className="source-heading">全屏摄像头 <span>⌄</span><span className="more">•••</span></div>
            <button className="source-row" onClick={toggleCamera}>{I.camera}<span>相机</span><span className="source-dot" /></button>
            <div className="source-space" />
            <button className="add-source" onClick={toggleCamera}>添加源</button>
          </section>
          <section className="panel tools">
            <h2>工具 <b className="pink-dot" /></h2>
            <p className="section-label">互动</p>
            <div className="tool-grid">
              <button className="tool" onClick={startDemo}>{I.sparkle}<span>表情特效</span></button>
              <button className="tool" disabled title={unavailable}>{I.gift}<span>观众心愿</span></button>
              <button className="tool" onClick={startDemo}>{I.target}<span>一起玩</span></button>
              <button className="tool" onClick={openSettings}>{I.sliders}<span>互动设置</span></button>
            </div>
            <p className="section-label">成长中心</p>
            <div className="tool-grid">
              <button className="tool" disabled title={unavailable}>{I.heart}<span>粉丝团</span></button>
              <button className="tool" onClick={openHelp}>{I.book}<span>玩法手册</span></button>
              <button className="tool" disabled title={unavailable}>{I.gift}<span>礼物展馆</span></button>
            </div>
          </section>
        </aside>

        <section className="center">
          <div className="preview-toolbar">
            <span>直播预览 <small>9:19.5</small></span>
            <span className="ai-badge">✦ 表情互动已就绪</span>
          </div>
          <div className="preview-space">
            <section
              ref={stageRef}
              className={`stage${mode === 'demo' ? ' night-demo' : ''}`}
              style={{ touchAction: mode === 'demo' ? 'none' : 'pan-y' }}
              aria-label="9:19.5 直播互动预览"
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
            >
              <Camera ref={face.videoRef} {...face.cameraProps} />
              <canvas ref={overlayRef} className="effect-layer" aria-hidden="true" />
              <RainEffect ref={rainRef} />
              <FireworkEffect ref={fireworksRef} />
              <FaceTracker {...face.trackerProps} />

              <div className="stage-top">
                <div className="identity"><span className="avatar">{I.user}</span><strong>Libra Mars</strong></div>
                <span className="preview-tag">预览</span>
              </div>
              {(mode === 'idle' || mode === 'loading') && (
                <div className="welcome">
                  <div className="camera-placeholder">{I.camera}</div>
                  <h1>准备好你的直播画面</h1>
                  <p>开启摄像头，让表情点亮画面</p>
                </div>
              )}
              <div className="stage-bottom">
                <span>{hint}</span>
                <div className="stage-social" aria-hidden="true">♡　↗　•••</div>
              </div>
            </section>
          </div>

          <div className="below-preview">
            <span>{modeLabel}</span>
            <span>画布 9:19.5</span>
          </div>
          {mode === 'demo' && (
            <div id="demoControls">
              <span className="demo-label">模拟表情 · 拖动画面移动头部</span>
              <div className="demo-buttons">
                {EXPRESSIONS.map(e => (
                  <button key={e.id} aria-pressed={demoExpression === e.id} onClick={() => selectDemoExpression(e.id)}>{e.label}</button>
                ))}
              </div>
            </div>
          )}
          <div className="bottom-tools">
            <div className="toolbar-group">
              <button className="icon-button" aria-label="体验特效" title="体验特效" onClick={startDemo}>{I.sparkle}</button>
              <button className="icon-button" aria-label="相机" title="相机" onClick={toggleCamera}>{I.camera}</button>
              <button className="icon-button" aria-label="预览全屏" title="预览全屏" onClick={toggleFullscreen}>{I.monitor}</button>
            </div>
            <div className="toolbar-group">
              <button className="icon-button" aria-label="特效设置" onClick={openSettings}>{I.sliders}</button>
              <span className="audio-control" title="本地预览不采集声音">{I.speaker}<span className="audio-track"><i /></span></span>
              <span className="audio-control" title="麦克风未启用">{I.mic}<span className="audio-track mic"><i /></span></span>
            </div>
            <button className="primary" onClick={toggleCamera}>
              {mode === 'loading' ? '取消开启' : mode === 'camera' ? '关闭摄像头' : '开启摄像头'} <span>{cameraOn ? '×' : '↗'}</span>
            </button>
          </div>
          <footer className="runtime">
            <span>本地预览 · 未推流</span>
            <span>{hud.particles} 粒子</span>
            <span>{hud.collisions} 次碰撞</span>
            <span>识别 {mode === 'camera' ? hud.ms : '—'} ms</span>
            <span>{mode === 'idle' ? '—' : hud.fps} FPS</span>
          </footer>
        </section>

        <aside className="panel performance">
          <h2>直播表现</h2>
          <div className="live-metrics">
            <span>💎 -</span><span>＄ -</span><span>♧ -</span><span>♙ -</span><span>♡ -</span><span>{I.gift} -</span>
          </div>
          <div className="audience-empty">
            <svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="m28 26-8-13 14 5 8-12 4 18M20 84l8-19c-6-39 36-54 43-17l9 27 9-28c8 15 3 26-6 36M35 45l3-2m15-4 3-1m-20 17q12 10 20-5" />
            </svg>
            <p>还没有在线观众</p>
            <small>本地预览，尚未连接直播平台</small>
          </div>
          <div className="status-box">
            <span className="status-dot" />
            <p role="status" aria-live="polite">{status}</p>
          </div>
        </aside>
      </main>

      <dialog ref={settingsRef}>
        <div className="dialog-title">
          <h2>表情互动设置</h2>
          <button className="icon-button" aria-label="关闭设置" onClick={() => settingsRef.current.close()}>×</button>
        </div>
        <div className="readings">
          <div><span>微笑指数</span><output>{Math.round(hud.smile * 100)}%</output></div>
          <meter min="0" max="1" value={hud.smile} aria-label="微笑指数" />
          <div><span>张嘴程度</span><output>{Math.round(hud.jaw * 100)}%</output></div>
          <meter min="0" max="1" value={hud.jaw} aria-label="张嘴程度" />
        </div>
        <div className="toggle">
          <label htmlFor="outline">显示碰撞轮廓</label>
          <input id="outline" type="checkbox" checked={showOutline} onChange={e => setShowOutline(e.target.checked)} />
        </div>
        <div className="toggle">
          <label htmlFor="gentle">柔和特效</label>
          <input id="gentle" type="checkbox" checked={gentle} onChange={e => setGentle(e.target.checked)} />
        </div>
        <p className="settings-note">微笑落下 {RAIN_DURATION_MS / 1000} 秒星雨，大笑绽放烟花。两种特效不会同时出现。</p>
      </dialog>

      <dialog ref={helpRef}>
        <div className="dialog-title">
          <h2>玩法手册</h2>
          <button className="icon-button" aria-label="关闭帮助" onClick={() => helpRef.current.close()}>×</button>
        </div>
        <p>开启摄像头后，自然微笑触发星雨，张嘴大笑触发烟花。移动头部接住散落火星。</p>
        <p>没有摄像头也可以点击「表情特效」，选择模拟表情并拖动画面里的头部。</p>
        <p>这是本地互动预览，未连接 TikTok 账号或直播推流。</p>
      </dialog>
    </>
  );
}
