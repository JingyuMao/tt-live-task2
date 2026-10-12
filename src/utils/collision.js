// 头部与粒子的碰撞计算。纯逻辑，无 DOM。

// MediaPipe Face Mesh 中沿面部外缘排列的 36 个关键点，按顺序构成闭合多边形。
export const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

/**
 * 把归一化关键点映射到画面坐标。
 * 与 <video> 的 object-fit: cover + 水平镜像完全一致，保证轮廓与画面中的脸重合。
 */
export function faceOutline(landmarks, videoWidth, videoHeight, width, height) {
  const s = Math.max(width / videoWidth, height / videoHeight);
  const ox = (width - videoWidth * s) / 2;
  const oy = (height - videoHeight * s) / 2;
  return OVAL.map(i => ({ x: ox + (1 - landmarks[i].x) * videoWidth * s, y: oy + landmarks[i].y * videoHeight * s }));
}

// 演示模式用的椭圆“头部”。
export function ellipseOutline(cx, cy, rx, ry, points = 36) {
  return Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
}

// 射线法判断点是否在多边形内。
export function inside(x, y, poly) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

/**
 * 圆形粒子与多边形边界碰撞：最近边投影 + 法向反射（恢复系数 0.72）。
 * 粒子已侵入轮廓（例如头部移动压到粒子）时，把它推回外侧。
 * 调用方需按速度细分时间步，防止高速粒子穿透。
 * @param {{x:number,y:number,vx:number,vy:number}} p 会被原地修改
 * @returns {boolean} 是否发生碰撞
 */
export function collide(p, poly, radius = 3) {
  if (poly.length < 3) return false;
  let min = Infinity, qx = 0, qy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const x = a.x + t * dx, y = a.y + t * dy, d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < min) { min = d; qx = x; qy = y; }
  }
  const within = inside(p.x, p.y, poly);
  if (!within && min > radius * radius) return false;

  let nx = p.x - qx, ny = p.y - qy, len = Math.hypot(nx, ny);
  if (len < 1e-6) {
    const cx = poly.reduce((s, v) => s + v.x, 0) / poly.length;
    const cy = poly.reduce((s, v) => s + v.y, 0) / poly.length;
    nx = qx - cx; ny = qy - cy; len = Math.hypot(nx, ny) || 1;
  } else if (within) { nx = -nx; ny = -ny; }
  nx /= len; ny /= len;
  p.x = qx + nx * (radius + 0.7);
  p.y = qy + ny * (radius + 0.7);

  const dot = p.vx * nx + p.vy * ny;
  if (dot < 0) { p.vx -= 1.72 * dot * nx; p.vy -= 1.72 * dot * ny; }
  return true;
}
