/**
 * Removes the background from a profile photo, on the device. The person is found with MediaPipe Selfie
 * Segmentation; the model files are served from /mediapipe/selfie so nothing is uploaded.
 * If the model cannot find a clear person, the original photo is kept and `removed` is false.
 */

const MODEL_DIR = '/mediapipe/selfie';
const SIZE = 512;

interface SegmentationResults { segmentationMask: CanvasImageSource; image: CanvasImageSource }
interface SegmentationModel {
  setOptions(o: { modelSelection: number }): void;
  onResults(cb: (r: SegmentationResults) => void): void;
  initialize(): Promise<void>;
  send(input: { image: CanvasImageSource }): Promise<void>;
}
type SegmentationCtor = new (o: { locateFile: (file: string) => string }) => SegmentationModel;

let loading: Promise<SegmentationModel> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('The background model could not be loaded.'));
    document.head.appendChild(el);
  });
}

async function model(): Promise<SegmentationModel> {
  if (!loading) {
    loading = (async () => {
      const w = window as unknown as { SelfieSegmentation?: SegmentationCtor };
      if (!w.SelfieSegmentation) await loadScript(`${MODEL_DIR}/selfie_segmentation.js`);
      if (!w.SelfieSegmentation) throw new Error('The background model did not start.');
      const m = new w.SelfieSegmentation({ locateFile: (file) => `${MODEL_DIR}/${file}` });
      m.setOptions({ modelSelection: 1 });
      await m.initialize();
      return m;
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

function drawSquare(src: CanvasImageSource): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('canvas unavailable');
  g.drawImage(src, 0, 0, SIZE, SIZE);
  return g;
}

/** Returns a PNG with a transparent background, or the original photo when no clear person is found. */
export async function removeBackground(dataUrl: string): Promise<{ dataUrl: string; removed: boolean }> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('photo could not be read'));
      i.src = dataUrl;
    });
    const seg = await model();
    let mask: CanvasImageSource | null = null;
    let photo: CanvasImageSource | null = null;
    seg.onResults((r) => { mask = r.segmentationMask; photo = r.image; });
    const input = drawSquare(img).canvas;
    await seg.send({ image: input });
    if (!mask || !photo) return { dataUrl, removed: false };

    const maskData = drawSquare(mask).getImageData(0, 0, SIZE, SIZE);
    const photoData = drawSquare(photo).getImageData(0, 0, SIZE, SIZE);
    let person = 0;
    for (let i = 0; i < maskData.data.length; i += 4) {
      // The mask is grey: brightness is the chance that a pixel belongs to the person.
      const p = maskData.data[i];
      const alpha = p < 90 ? 0 : p > 170 ? 255 : Math.round(((p - 90) / 80) * 255);
      photoData.data[i + 3] = alpha;
      if (alpha > 127) person++;
    }
    const share = person / (SIZE * SIZE);
    // No clear person (empty frame or the whole frame): keep the original photo.
    if (share < 0.05 || share > 0.95) return { dataUrl, removed: false };

    const out = document.createElement('canvas');
    out.width = out.height = SIZE;
    out.getContext('2d')?.putImageData(photoData, 0, 0);
    return { dataUrl: out.toDataURL('image/png'), removed: true };
  } catch {
    return { dataUrl, removed: false };
  }
}
