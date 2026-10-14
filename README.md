# tt-live · 直播间表情互动特效

TikTok LIVE Studio 风格的直播间 AR 互动原型：摄像头实时识别表情，**微笑触发星雨，张嘴大笑触发烟花**，烟花粒子会与人脸轮廓发生物理碰撞反弹。React + Vite，9:19.5 手机竖屏预览。

- 在线体验：https://jingyumao.github.io/tt-live-task2/
- 不接入 TikTok 账号，不推流、不录制、不上传摄像头影像，识别全部在浏览器本地完成。

## 快速开始

需要 Node.js 20.19+ 或 22+。

```sh
npm ci
npm run dev
```

打开终端显示的 localhost 地址，点击「开启摄像头」并允许授权。摄像头需要 HTTPS 或 localhost。

界面中只有「开启摄像头 / 关闭摄像头」按钮可交互，其余工作台控件仅作展示。

## 当前行为

- 微笑：触发 3.1 秒星雨，之后约 0.8 秒淡出，看得见的部分约 3.9 秒，与星雨音乐同时结束。云雾约 650ms 形成，星雨同时开始；持续微笑不会延长本轮。
- 大笑：烟花和星雨一样固定在画面上方的同一位置，每轮都是完整的 5 朵（按额头位于画面 45% 高度时的版本布局，`FIXED_FOREHEAD`），不随人脸位置缩小或减少；系统开启「减少动态效果」时为 2 朵。人脸较高时烟花会在脸前方绽放，火星离开脸后再与轮廓碰撞反弹。
- 烟花：保留三组配色、高低错落、星芒、流动亮点和二次火星，整体速度 0.85 倍。整组（含余烬）在大笑后约 4 秒结束，与烟花音效同时收尾（`BOUQUET_SECONDS`）；后几朵完整绽放后更快淡出，不在画面里拖尾。目标尺寸为放大后的版本，实际尺寸受画面和额头上方空间限制。
- 碰撞：所有烟花粒子与 MediaPipe 人脸轮廓反弹，拖尾沿反弹路径绘制。碰撞轮廓不显示（`useStudio.js` 中的 `SHOW_OUTLINE` 设计开关）。碰撞依据不包含头发外沿。
- 两种特效严格互斥、互不打断：星雨（含淡出）或烟花（含余烬）完全结束前，另一种表情的触发直接忽略，不排队补放；同一特效也不会叠加或重启。结束时如果仍在大笑，会接着放烟花；微笑需重新做一次才会下星雨。

## 文件结构

```text
tt-live/
├── .github/workflows/deploy.yml # 自动构建并发布到 GitHub Pages
├── public/
│   ├── assets/audio/        # 星雨特效音乐 + 烟花特效音与配乐
│   ├── vendor/              # 本地 MediaPipe、WASM、识别模型与许可证
│   ├── tracker-worker.js    # 后台人脸推理（必须是 Classic Worker）
│   └── diagnostics.html     # 模型自检页
├── scripts/
│   └── build-standalone.mjs # 可选：生成可离线双击打开的单文件 HTML
├── src/
│   ├── components/
│   │   ├── Camera.jsx       # 摄像头开关、权限、镜像竖屏画面
│   │   ├── FaceTracker.jsx  # Worker 创建、逐帧送识别、卸载清理
│   │   ├── RainEffect.jsx   # 持有星雨引擎实例，避免逐帧 React 更新
│   │   ├── FireworkEffect.jsx
│   │   └── StudioStats.jsx  # 预览下方的状态文字（订阅 hudStore）
│   ├── hooks/
│   │   ├── useStudio.js     # 工作台状态：摄像头开关与状态文案（组合下面两个）
│   │   ├── useFaceInput.js  # 摄像头 → 识别流程，最新识别结果
│   │   └── useEffectLoop.js # 共享帧循环：表情判定、特效调度、声音同步、绘制
│   ├── engines/             # 特效算法，与界面分开，便于单独调节与测试
│   │   ├── rain.js
│   │   ├── fireworks.js
│   │   └── effects.js       # 特效互斥（互不打断）与星雨时长
│   ├── utils/
│   │   ├── expression.js    # 表情平滑、阈值、稳定窗口、冷却和计时
│   │   ├── collision.js     # 多边形碰撞和人脸轮廓点位
│   │   ├── audio.js         # AUDIO 设计参数表 + Web Audio 播放
│   │   ├── hudStore.js      # 界面状态的外部 store
│   │   ├── trackerSession.js # 模型预初始化、复用、重试和过期帧隔离
│   │   └── tracker.js       # 创建普通或内嵌资源 Worker
│   ├── App.jsx              # LIVE Studio 工作台界面
│   ├── main.jsx
│   └── index.css
├── tests/                   # npm test
├── LICENSE / THIRD_PARTY.md # 本项目与第三方许可
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

React 管理组件挂载与页面结构；高频粒子状态留在引擎中，由共享 Canvas 绘制，不使用 React state 驱动每个粒子。卸载时停止帧循环、断开 ResizeObserver、终止 Worker、关闭摄像头、关闭音频并移除事件监听。使用 StrictMode 检查重复挂载清理。

## 性能设计

- **推理不占主线程**：MediaPipe Face Landmarker 跑在 Web Worker 中；帧以 `ImageBitmap` 转移（零拷贝），先缩到 480px 宽。
- **按需推理**：同一时间只有一帧在途；推理间隔随实际耗时自适应（≥50 ms，即最多约 20 次/秒）；视频没有新帧、页面在后台时都不识别。
- **渲染不经过 React**：粒子状态留在引擎对象池中（星雨 260、烟花 520 个固定上限，复用不新建），共享一张 Canvas 绘制；纹理首次生成后缓存。烟花存活粒子数随生成/消亡增减，不每帧扫描粒子池。
- **界面状态不触发整页重绘**：人脸锁定状态写入外部 store（`utils/hudStore.js`），只有预览下方的状态文字订阅，状态不变时不通知；工作台主体在摄像头运行时不重新渲染。
- **动画帧率上限 30 FPS**：与 TikTok Effect House 上限一致；60/120 Hz 屏幕上绘制次数减为 1/2～1/4。粒子运动与烟花拖尾采样都按真实时间计算，降帧不改变速度、时长和拖尾长度（有单元测试对比 30 / 60 FPS）。
- **画布分辨率封顶**：devicePixelRatio 最高按 1.5 计算。
- **两种特效互斥**：同一时刻只模拟、绘制一种特效。
- **资源本地化与预加载**：模型、WASM 自托管，无运行时 CDN 依赖。页面打开后即在 Worker 中加载并初始化模型与 WASM，顶部显示准备状态；此时不请求摄像头权限、不采集画面。点击开启后才授权摄像头并发送视频帧；若模型仍在准备，会等待完成。关闭摄像头保留已初始化模型，重开时复用；离开页面或卸载时释放。预加载失败后开启摄像头会重试。首次耗时取决于网络与设备，不承诺固定时间；单文件版直接初始化内嵌资源，无需下载。音频共约 0.4 MB，在首次点击时解码。
- **生命周期清理**：关闭摄像头时停止送帧并释放摄像头轨道，保留已初始化模型；离开页面或卸载时终止 Worker 并清理资源。StrictMode 的首次试挂载取消准备任务，避免重复下载。

## 修改参数

- 烟花大小、朵数、布局、配色：`src/engines/fireworks.js`，搜索 `BLOOM_SIZE`、`FIXED_FOREHEAD`（固定位置）、`FINALE`、`PALETTES`。
- 星雨粒子、云雾和拖尾：`src/engines/rain.js`。
- 星雨时长：`src/utils/expression.js` 中的 `RAIN_DURATION_MS`；它与星雨音乐时长绑定，换音乐时同步修改，`npm test` 会检查两者是否对齐。
- 表情灵敏度、判定：`src/utils/expression.js`。
- 碰撞反弹：`src/utils/collision.js`。
- 声音：`src/utils/audio.js` 中的 `AUDIO`（每个特效的音轨、音量、起点、延迟、淡入淡出）。星雨用一条合成好的 `星雨特效音乐.mp3`，自然结束时播完整段；烟花是特效音 + 配乐两条。替换音频时改 `AUDIO` 即可；`npm test` 会检查文件夹里没有多余或缺失的音频。
- 页面样式：`src/index.css`。

## 测试与构建

```sh
npm test               # 单元测试（表情判定、碰撞、粒子上限、特效互斥、音频配置）
npm run build:web      # 生成 dist/，可部署到任意 HTTPS 静态托管（Vercel / Netlify / GitHub Pages）
npm run preview
```

可选：`npm run build:standalone` 生成单文件 `TT直播间特效.html`（内嵌模型、WASM 与音频，约 18 MB），可直接双击离线体验；该文件不纳入仓库。

开发服务启动后可访问 `/diagnostics.html`，点击「运行自检」，用空白图片验证本地模型、WASM 和 Worker，无需摄像头。

`dist/` 使用相对资源路径，兼容子目录部署。推送到 `main` 后，`.github/workflows/deploy.yml` 会自动测试、构建并发布到 GitHub Pages（仓库 Settings → Pages → Source 选 GitHub Actions）。

识别模型和 WASM 已放在 public/vendor，无需运行时访问 CDN。安装 npm 依赖仍需要网络（或完整的 npm 缓存）。具体第三方许可见 `THIRD_PARTY.md` 和 `public/vendor/`。

## 验证边界

单元测试覆盖表情判定、碰撞、防穿透、粒子上限、3/5 朵切换、特效互斥和清理。真实摄像头权限、不同设备性能和真实表情准确率仍需在目标设备实测；演示模式不替代真实摄像头验收。
