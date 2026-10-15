#!/usr/bin/env node
/**
 * يحوّل فيديوهات الدروس من MP4 (في R2) إلى HLS مشفّر AES-128 تلقائيًا،
 * ثم يرفعها إلى R2 تحت hls/<lessonId>/ ويفعّل lessons.hls_ready = true.
 *
 * الاستخدام (من مجلد scripts/hls-converter بعد npm install):
 *   node convert-lessons.mjs --dry-run          # يعرض ما سيُحوَّل فقط
 *   node convert-lessons.mjs                    # يحوّل كل الدروس غير المحوَّلة ثم ينتهي
 *   node convert-lessons.mjs --lesson <uuid>    # درس واحد
 *   node convert-lessons.mjs --watch            # يعمل باستمرار ويلتقط الفيديوهات الجديدة (كل 60 ثانية)
 *
 * المتغيرات (لا تضعها في المستودع):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *
 * المتطلبات: Node 18+ و ffmpeg و ffprobe.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- أدوات نقية (قابلة للاختبار)

export function decodeStreamToken(token) {
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    return decodeURIComponent(Buffer.from(b64, 'base64').toString('binary'));
  } catch {
    return decodeURIComponent(token);
  }
}

/** يستخرج مفتاح الملف في R2 من قيمة lessons.video_url، أو null إن لم يكن ملفًا في R2 (يوتيوب/Bunny/...). */
export function extractKey(videoUrl) {
  if (!videoUrl) return null;
  const v = String(videoUrl).trim();
  if (!/^https?:\/\//i.test(v)) return v.replace(/^\/+/, '');
  let u;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (!u.hostname.endsWith('workers.dev')) return null;
  const q = u.searchParams.get('key');
  if (q) return q.replace(/^\/+/, '');
  const m = u.pathname.match(/^\/(video|stream)\/(.+)$/);
  if (!m) return null;
  const raw = m[1] === 'video' ? decodeURIComponent(m[2]) : decodeStreamToken(m[2]);
  return raw.replace(/^\/+/, '');
}

function run(cmd, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'] });
    let out = '';
    if (capture) p.stdout.on('data', (d) => (out += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

async function probe(input, stream) {
  try {
    return await run(
      'ffprobe',
      ['-v', 'error', '-select_streams', stream, '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', input],
      { capture: true },
    );
  } catch {
    return '';
  }
}

/** يحوّل ملفًا محليًا إلى HLS مشفّر داخل outDir. يعيد مسار المجلد. نفس منطق scripts/convert-to-hls.sh */
export async function convertToHls({ input, outDir }) {
  await mkdir(outDir, { recursive: true });
  const keyPath = path.join(outDir, 'key');
  await writeFile(keyPath, randomBytes(16));
  const keyInfo = path.join(outDir, '..', `keyinfo-${path.basename(outDir)}.txt`);
  await writeFile(keyInfo, `key\n${keyPath}\n${randomBytes(16).toString('hex')}\n`);

  const v = await probe(input, 'v:0');
  const a = await probe(input, 'a:0');
  const copyOk = v === 'h264' && (a === 'aac' || a === '');
  const codecArgs = copyOk
    ? ['-c', 'copy']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k'];

  try {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', input, ...codecArgs,
      '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_list_size', '0',
      '-hls_key_info_file', keyInfo,
      '-hls_segment_filename', path.join(outDir, 'seg%05d.ts'),
      path.join(outDir, 'index.m3u8'),
    ]);
  } finally {
    await rm(keyInfo, { force: true });
  }
  return outDir;
}

// ---------------------------------------------------------------- التخزين وقاعدة البيانات

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`المتغير ${name} غير موجود`);
  return v;
}

async function makeR2() {
  const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
  const bucket = env('R2_BUCKET');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
  });
  return {
    async exists(key) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },
    async download(key, file) {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      await pipeline(res.Body, createWriteStream(file));
    },
    async upload(key, file) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: await readFile(file) }));
    },
  };
}

function makeDb() {
  const base = `${env('SUPABASE_URL').replace(/\/+$/, '')}/rest/v1`;
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const req = async (p, init = {}) => {
    const r = await fetch(`${base}/${p}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    return r.json();
  };
  return {
    pending: (limit) =>
      req(`lessons?select=id,video_url&hls_ready=eq.false&video_url=not.is.null&order=created_at.asc&limit=${limit}`),
    one: (id) => req(`lessons?select=id,video_url&id=eq.${id}`),
    // يفعّل الدرس فقط إن لم يتغير الفيديو أثناء التحويل (يمنع تفعيل نسخة قديمة)
    markReady: (id, videoUrl) =>
      req(`lessons?id=eq.${id}&video_url=eq.${encodeURIComponent(videoUrl)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ hls_ready: true }),
      }),
  };
}

// ---------------------------------------------------------------- المعالجة

async function processLesson(lesson, { r2, db, dryRun }) {
  const tag = `[${lesson.id}]`;
  const key = extractKey(lesson.video_url);
  if (!key) return console.log(`${tag} تخطّي: الفيديو ليس ملفًا في R2 (${String(lesson.video_url).slice(0, 60)})`);
  if (dryRun) return console.log(`${tag} سيُحوَّل: ${key}`);

  const candidates = key.startsWith('videos/') ? [key] : [key, `videos/${key}`];
  let source = null;
  for (const c of candidates) if (await r2.exists(c)) { source = c; break; }
  if (!source) return console.warn(`${tag} الملف الأصلي غير موجود في R2: ${candidates.join(' | ')}`);

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'hls-'));
  try {
    const input = path.join(tmp, 'input.mp4');
    console.log(`${tag} تنزيل ${source} ...`);
    await r2.download(source, input);

    console.log(`${tag} تحويل وتشفير ...`);
    const out = await convertToHls({ input, outDir: path.join(tmp, lesson.id) });

    const files = (await readdir(out)).filter((f) => f !== 'index.m3u8');
    // نرفع المقاطع والمفتاح أولًا ثم القائمة آخرًا حتى لا يظهر درس نصف جاهز
    for (const f of files) await r2.upload(`hls/${lesson.id}/${f}`, path.join(out, f));
    await r2.upload(`hls/${lesson.id}/index.m3u8`, path.join(out, 'index.m3u8'));

    const updated = await db.markReady(lesson.id, lesson.video_url);
    if (updated.length === 0) console.warn(`${tag} تغيّر الفيديو أثناء التحويل؛ سيُعاد في الدورة القادمة`);
    else console.log(`${tag} ✅ جاهز (${files.length - 1} مقطع)`);
  } finally {
    await rm(tmp, { recursive: true, force: true }); // يحتوي ملف المفتاح
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : null);
  const dryRun = flag('dry-run');
  const db = makeDb();
  const r2 = dryRun ? null : await makeR2();

  const cycle = async () => {
    const lessons = opt('lesson') ? await db.one(opt('lesson')) : await db.pending(Number(opt('limit')) || 500);
    console.log(`عدد الدروس غير المحوَّلة: ${lessons.length}`);
    for (const l of lessons) {
      try {
        await processLesson(l, { r2, db, dryRun });
      } catch (e) {
        console.error(`[${l.id}] فشل: ${e.message}`);
      }
    }
  };

  if (!flag('watch')) return cycle();
  for (;;) {
    try { await cycle(); } catch (e) { console.error('دورة فاشلة:', e.message); }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
