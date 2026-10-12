import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

function explain(error) {
  if (error.name === 'NotAllowedError') return '摄像头权限未获允许。可在地址栏授权后重试。';
  if (error.name === 'NotFoundError') return '未找到摄像头，请连接设备。';
  return error.message || String(error);
}

/**
 * 摄像头组件：enabled 为 true 时请求前置摄像头（原生画幅，按 9:19.5 竖屏显示），关闭时释放设备。
 * 画面镜像、铺满（object-fit: cover）。ref 指向 <video> 元素，供人脸识别读取帧。
 * 只请求视频，不请求麦克风；影像不录制、不上传。
 */
const Camera = forwardRef(function Camera({ enabled, onStarted, onError }, ref) {
  const videoRef = useRef(null);
  useImperativeHandle(ref, () => videoRef.current, []);
  // 回调放进 ref，父组件重渲染时不会重启摄像头。
  const callbacks = useRef({ onStarted, onError });
  callbacks.current = { onStarted, onError };

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false, stream = null;
    const video = videoRef.current;
    // 请求超时：用户既不允许也不拒绝时给出提示。
    const timer = setTimeout(() => {
      if (!cancelled && !stream) callbacks.current.onError?.('摄像头请求未完成。请在浏览器中允许权限后重试。');
    }, 30000);

    (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('请使用 HTTPS 或 localhost 打开，并允许摄像头访问。');
        }
        // 只请求摄像头原生画幅，不指定 9:19.5 比例：指定比例会让浏览器先裁切再放大（crop-and-scale），
        // 画面被放大且识别只能看到脸的一部分。竖屏裁切交给 CSS object-fit: cover，识别始终拿到完整画面。
        const incoming = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 }, resizeMode: { ideal: 'none' } },
          audio: false,
        });
        if (cancelled) { incoming.getTracks().forEach(t => t.stop()); return; }
        stream = incoming;
        clearTimeout(timer);
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        stream.getVideoTracks()[0].onended = () => {
          if (!cancelled) callbacks.current.onError?.('摄像头连接已结束，请重新开启。');
        };
        callbacks.current.onStarted?.();
      } catch (error) {
        if (!cancelled) callbacks.current.onError?.(explain(error));
      }
    })();

    // 页面切到后台时暂停摄像头轨道。
    const onVisibility = () => stream?.getVideoTracks().forEach(t => { t.enabled = !document.hidden; });
    document.addEventListener('visibilitychange', onVisibility);
    const onPageHide = () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()); };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      stream?.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    };
  }, [enabled]);

  return <video ref={videoRef} className="camera-video" playsInline muted autoPlay hidden={!enabled} />;
});

export default Camera;
