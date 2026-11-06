// Remove only pale neutral pixels connected to the edge of the supplied artwork.
// Original PNGs, including their painted checkerboard background, remain intact.
export async function loadArt(path) {
  const image = new Image();
  image.src = path;
  await image.decode();
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 600 / image.width);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
    d = pixels.data,
    w = canvas.width,
    h = canvas.height,
    seen = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  let head = 0,
    tail = 0;
  function visit(i) {
    if (i < 0 || i >= w * h || seen[i]) return;
    seen[i] = 1;
    const p = i * 4,
      min = Math.min(d[p], d[p + 1], d[p + 2]),
      max = Math.max(d[p], d[p + 1], d[p + 2]);
    if (d[p + 3] === 0 || (min > 175 && max - min < 18)) {
      queue[tail++] = i;
      d[p + 3] = 0;
    }
  }
  for (let x = 0; x < w; x++) {
    visit(x);
    visit((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    visit(y * w);
    visit(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    if (i % w) visit(i - 1);
    if (i % w < w - 1) visit(i + 1);
    visit(i - w);
    visit(i + w);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
