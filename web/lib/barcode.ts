"use client";

// QR code / barcode reading for the scanner. Uses the browser's own BarcodeDetector when it has one
// (Android, macOS, ChromeOS) and otherwise ZXing (open source), which is only downloaded when needed.

export type Region = { x: number; y: number; w: number; h: number }; // fractions (0–1) of the image
type Decode = (canvas: HTMLCanvasElement) => Promise<string | null>;

type NativeDetector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type NativeDetectorClass = { new (opts: { formats: string[] }): NativeDetector; getSupportedFormats: () => Promise<string[]> };

let decoderPromise: Promise<Decode> | null = null;

/** One shared decoder: native detector first (fast), ZXing in "try harder" mode as the fallback. */
export function getDecoder(): Promise<Decode> {
  decoderPromise ??= (async () => {
    let native: NativeDetector | null = null;
    const NativeClass = (window as unknown as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
    if (NativeClass) {
      try {
        const formats = await NativeClass.getSupportedFormats();
        if (formats.length) native = new NativeClass({ formats });
      } catch {
        native = null;
      }
    }

    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
    const hints = new Map<number, unknown>([
      [DecodeHintType.TRY_HARDER, true],
      [
        DecodeHintType.POSSIBLE_FORMATS,
        [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
        ],
      ],
    ]);
    const reader = new BrowserMultiFormatReader(hints);

    return async (canvas) => {
      if (native) {
        try {
          const found = await native.detect(canvas);
          if (found[0]?.rawValue) return found[0].rawValue;
        } catch {
          /* fall through to ZXing */
        }
      }
      try {
        return reader.decodeFromCanvas(canvas).getText();
      } catch {
        return null; // nothing readable in this picture
      }
    };
  })();
  return decoderPromise;
}

/**
 * Copy part of an image/video frame into a canvas, scaled so its longest side is `size` px.
 * Zooming into the middle makes small or distant codes big enough to read.
 */
export function crop(source: CanvasImageSource, width: number, height: number, region: Region, size: number, canvas = document.createElement("canvas")) {
  const sw = width * region.w;
  const sh = height * region.h;
  const scale = size / Math.max(sw, sh);
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, width * region.x, height * region.y, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const centre = (f: number): Region => ({ x: (1 - f) / 2, y: (1 - f) / 2, w: f, h: f });

/** The views tried in turn on live video: the aiming box, a closer zoom, and the whole picture. */
export const VIDEO_VIEWS: { region: Region; size: number }[] = [
  { region: centre(0.6), size: 900 },
  { region: centre(0.38), size: 800 },
  { region: centre(1), size: 1280 },
];

/** Read a code from a photo (camera picture or saved image). Tries the whole photo and zoomed-in views. */
export async function decodePhoto(file: File): Promise<string | null> {
  const decode = await getDecoder();
  const bitmap = await createImageBitmap(file);
  try {
    // Quick views first; the slow full-size view only if those fail.
    for (const view of [
      { region: centre(0.6), size: 1000 },
      { region: centre(1), size: 1400 },
      { region: centre(0.35), size: 900 },
      { region: centre(1), size: 2400 },
    ]) {
      const code = await decode(crop(bitmap, bitmap.width, bitmap.height, view.region, view.size));
      if (code) return code;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
