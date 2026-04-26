import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;

export type ProgressCallback = (progress: number, message: string) => void;

/**
 * Load and return the singleton FFmpeg instance.
 * Uses CDN-hosted core for Vite compatibility.
 */
export async function getFFmpeg(onProgress?: ProgressCallback): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;

  const ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });

  ffmpeg.on('progress', ({ progress, time }) => {
    const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    onProgress?.(pct, `Processing... ${pct}%`);
  });

  // Use ESM builds for Vite - use single-threaded core for broader compatibility
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

  await ffmpeg.load({
    coreURL: `${baseURL}/ffmpeg-core.js`,
    wasmURL: `${baseURL}/ffmpeg-core.wasm`,
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export interface TrimOptions {
  startTime: number; // seconds
  endTime: number;   // seconds
}

export interface TextOverlayOptions {
  text: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  color: string; // hex color
  fontSize: number;
}

export interface ProcessVideoOptions {
  inputFile: File;
  trim?: TrimOptions;
  textOverlays?: TextOverlayOptions[];
  mergeFile?: File;
  mergePosition?: 'before' | 'after';
  onProgress?: ProgressCallback;
}

/**
 * Convert hex color to FFmpeg-friendly format (remove # prefix)
 */
function hexToFFmpegColor(hex: string): string {
  return hex.replace('#', '0x');
}

/**
 * Format seconds to HH:MM:SS.mmm for FFmpeg
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

/**
 * Process video with FFmpeg WASM: trim, add text, and/or merge.
 * Returns a Blob of the processed video.
 */
export async function processVideo(options: ProcessVideoOptions): Promise<Blob> {
  const { inputFile, trim, textOverlays, mergeFile, mergePosition = 'after', onProgress } = options;

  onProgress?.(0, 'Loading FFmpeg...');
  const ffmpeg = await getFFmpeg(onProgress);

  const inputName = 'input.mp4';
  const outputName = 'output.mp4';
  let currentInput = inputName;
  let stepCount = 0;

  // Write main input file
  onProgress?.(5, 'Loading video file...');
  await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

  // Step 1: Trim
  if (trim && (trim.startTime > 0 || trim.endTime < Infinity)) {
    const trimOutput = 'trimmed.mp4';
    onProgress?.(10, 'Trimming video...');

    const args = ['-i', currentInput];
    if (trim.startTime > 0) {
      args.push('-ss', formatTimestamp(trim.startTime));
    }
    if (trim.endTime < Infinity) {
      args.push('-to', formatTimestamp(trim.endTime - trim.startTime));
    }
    args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', trimOutput);

    await ffmpeg.exec(args);
    // Clean previous input if it was an intermediate
    if (currentInput !== inputName) await ffmpeg.deleteFile(currentInput);
    currentInput = trimOutput;
    stepCount++;
  }

  // Step 2: Text overlays
  if (textOverlays && textOverlays.length > 0) {
    const textOutput = 'texted.mp4';
    onProgress?.(40, 'Adding text overlays...');

    // Build filter chain for drawtext
    const filters = textOverlays.map((overlay) => {
      const color = hexToFFmpegColor(overlay.color);
      // Use percentage-based positioning
      const xPos = `(w*${overlay.x / 100})-(tw/2)`;
      const yPos = `(h*${overlay.y / 100})-(th/2)`;
      return `drawtext=text='${overlay.text.replace(/'/g, "\\'")}':fontsize=${overlay.fontSize}:fontcolor=${color}:x=${xPos}:y=${yPos}:shadowcolor=black:shadowx=2:shadowy=2`;
    }).join(',');

    await ffmpeg.exec([
      '-i', currentInput,
      '-vf', filters,
      '-c:a', 'copy',
      '-preset', 'ultrafast',
      '-tune', 'fastdecode',
      '-movflags', '+faststart',
      textOutput,
    ]);

    if (currentInput !== inputName) await ffmpeg.deleteFile(currentInput);
    currentInput = textOutput;
    stepCount++;
  }

  // Step 3: Merge
  if (mergeFile) {
    const mergeName = 'merge_input.mp4';
    const mergeOutput = 'merged.mp4';
    onProgress?.(60, 'Merging videos...');

    await ffmpeg.writeFile(mergeName, await fetchFile(mergeFile));

    // Re-encode both to ensure compatible formats before concat
    const reencA = 'reencode_a.ts';
    const reencB = 'reencode_b.ts';

    const first = mergePosition === 'before' ? mergeName : currentInput;
    const second = mergePosition === 'before' ? currentInput : mergeName;

    await ffmpeg.exec(['-i', first, '-c', 'copy', '-bsf:v', 'h264_mp4toannexb', '-f', 'mpegts', reencA]);
    await ffmpeg.exec(['-i', second, '-c', 'copy', '-bsf:v', 'h264_mp4toannexb', '-f', 'mpegts', reencB]);

    await ffmpeg.exec([
      '-i', `concat:${reencA}|${reencB}`,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      mergeOutput,
    ]);

    // Cleanup intermediates
    await ffmpeg.deleteFile(reencA);
    await ffmpeg.deleteFile(reencB);
    await ffmpeg.deleteFile(mergeName);
    if (currentInput !== inputName) await ffmpeg.deleteFile(currentInput);
    currentInput = mergeOutput;
    stepCount++;
  }

  // If no operations were performed, just copy
  if (stepCount === 0) {
    currentInput = inputName;
  }

  onProgress?.(90, 'Reading output...');
  const data = await ffmpeg.readFile(currentInput);

  // Clean up
  try {
    await ffmpeg.deleteFile(inputName);
    if (currentInput !== inputName) await ffmpeg.deleteFile(currentInput);
  } catch { /* ignore cleanup errors */ }

  onProgress?.(100, 'Done!');

  const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
  const buffer = new ArrayBuffer(uint8.byteLength);
  new Uint8Array(buffer).set(uint8);
  return new Blob([buffer], { type: 'video/mp4' });
}
