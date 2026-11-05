/**
 * Local background removal for custom pets (M3) — nothing leaves the machine.
 *
 * Model: U²-Net small (u2netp, Apache-2.0, from the rembg project), 4.6 MB, run with
 * onnxruntime-web on WebAssembly (single-threaded: the webview isn't cross-origin isolated).
 * Pre/post-processing mirrors rembg: 320×320 input, ImageNet normalisation, min-max mask.
 */
import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import { loadImage } from './image';

const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
/** longest side of the saved pet image */
export const PET_MAX = 512;

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };

let session: Promise<ort.InferenceSession> | null = null;
const getSession = () =>
  (session ??= ort.InferenceSession.create('/models/u2netp.onnx', { executionProviders: ['wasm'] }).catch((e) => {
    session = null;
    throw e;
  }));

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })!] as const;
}

/** Already a cut-out? (a real share of clearly transparent pixels) */
function hasTransparency(data: Uint8ClampedArray) {
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 200) clear++;
  return clear / (data.length / 4) > 0.03;
}

async function predictMask(img: CanvasImageSource): Promise<Float32Array> {
  const [, x] = canvas(SIZE, SIZE);
  x.drawImage(img, 0, 0, SIZE, SIZE);
  const px = x.getImageData(0, 0, SIZE, SIZE).data;
  let max = 1e-6;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const n = SIZE * SIZE;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) input[c * n + i] = (px[i * 4 + c] / max - MEAN[c]) / STD[c];
  }
  const s = await getSession();
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const pred = out[s.outputNames[0]].data as Float32Array;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { lo = Math.min(lo, pred[i]); hi = Math.max(hi, pred[i]); }
  const mask = new Float32Array(n);
  for (let i = 0; i < n; i++) mask[i] = (pred[i] - lo) / Math.max(1e-6, hi - lo);
  return mask;
}

export interface CutoutResult {
  /** trimmed PNG data URL, longest side ≤ PET_MAX */
  png: string;
  /** width / height */
  aspect: number;
  /** true when the input already had a transparent background (model skipped) */
  alreadyClear: boolean;
}

/**
 * Remove the background (unless `keepBackground`), trim to the subject and scale down.
 */
export async function cutout(src: string, keepBackground = false): Promise<CutoutResult> {
  const img = await loadImage(src);
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(1, Math.round(img.naturalWidth * k)), H = Math.max(1, Math.round(img.naturalHeight * k));
  const [c, x] = canvas(W, H);
  x.drawImage(img, 0, 0, W, H);
  const frame = x.getImageData(0, 0, W, H);
  const alreadyClear = hasTransparency(frame.data);

  if (!keepBackground && !alreadyClear) {
    const mask = await predictMask(img);
    // upscale the 320² mask with the browser's bilinear filter
    const [mc, mx] = canvas(SIZE, SIZE);
    const m = mx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
      // soften the threshold a little so edges stay smooth but halos go away
      const a = Math.min(1, Math.max(0, (mask[i] - 0.08) / 0.84));
      m.data[i * 4 + 3] = Math.round(a * 255);
    }
    mx.putImageData(m, 0, 0);
    const [, ux] = canvas(W, H);
    ux.imageSmoothingQuality = 'high';
    ux.drawImage(mc, 0, 0, W, H);
    const up = ux.getImageData(0, 0, W, H).data;
    for (let i = 3; i < frame.data.length; i += 4) frame.data[i] = up[i];
    x.putImageData(frame, 0, 0);
  }

  // trim to the visible subject (+ a small margin)
  const d = x.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let xx = 0; xx < W; xx++) {
      if (d[(y * W + xx) * 4 + 3] > 24) {
        if (xx < x0) x0 = xx;
        if (xx > x1) x1 = xx;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('nothing left after removing the background');
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02) + 2;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const s = Math.min(1, PET_MAX / Math.max(cw, ch));
  const [oc, ox] = canvas(Math.round(cw * s), Math.round(ch * s));
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(c, x0, y0, cw, ch, 0, 0, oc.width, oc.height);
  return { png: oc.toDataURL('image/png'), aspect: oc.width / oc.height, alreadyClear };
}
