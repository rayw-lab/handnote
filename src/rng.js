// 可复现随机数：同一种子同一页面每次渲染一致，换种子就是"再写一遍"
export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = next();
    v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // 低频平滑噪声：沿笔画参数 t∈[0,1] 取值，用于手抖
  const smooth = (knots = 4) => {
    const k = Array.from({ length: knots + 2 }, () => gauss());
    return (t) => {
      const x = t * knots, i = Math.floor(x), f = x - i, a = k[i], b = k[i + 1];
      const w = f * f * (3 - 2 * f);
      return a + (b - a) * w;
    };
  };
  return { next, gauss, smooth, range: (a, b) => a + (b - a) * next(), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}
