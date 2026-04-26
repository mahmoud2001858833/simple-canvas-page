import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Image as ImageIcon, Edit, Eye, Palette } from 'lucide-react';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';

interface CourseAdTemplateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  coursePrice?: number;
  courseDuration?: number;
  universityName?: string;
  collegeName?: string;
  majorName?: string;
  studyYear?: string;
  subjectName?: string;
  subjectCode?: string;
  instructorName?: string;
  slug?: string;
  thumbnailUrl?: string;
}

const STYLES = [
  {
    id: 'emerald', label: 'زمردي',
    bg1: '#021a12', bg2: '#0a3d2a', bg3: '#062015', accent: '#10b981', accent2: '#d4a843', glow: '#10b98140',
    previewGrad: 'linear-gradient(135deg, #021a12, #10b981)',
  },
  {
    id: 'midnight', label: 'منتصف الليل',
    bg1: '#0a0e27', bg2: '#1a2255', bg3: '#0d1135', accent: '#818cf8', accent2: '#f59e0b', glow: '#818cf840',
    previewGrad: 'linear-gradient(135deg, #0a0e27, #6366f1)',
  },
  {
    id: 'crimson', label: 'قرمزي',
    bg1: '#1a0a0a', bg2: '#3d1515', bg3: '#2a0e0e', accent: '#f87171', accent2: '#fbbf24', glow: '#f8717140',
    previewGrad: 'linear-gradient(135deg, #1a0a0a, #ef4444)',
  },
  {
    id: 'arctic', label: 'قطبي',
    bg1: '#0c1929', bg2: '#153050', bg3: '#0f2035', accent: '#22d3ee', accent2: '#a78bfa', glow: '#22d3ee40',
    previewGrad: 'linear-gradient(135deg, #0c1929, #06b6d4)',
  },
  {
    id: 'gold', label: 'ذهبي',
    bg1: '#1a1400', bg2: '#3d3000', bg3: '#2a2200', accent: '#f59e0b', accent2: '#fbbf24', glow: '#f59e0b40',
    previewGrad: 'linear-gradient(135deg, #1a1400, #f59e0b)',
  },
  {
    id: 'purple', label: 'بنفسجي',
    bg1: '#150a2e', bg2: '#2d1b5e', bg3: '#1f1145', accent: '#a855f7', accent2: '#ec4899', glow: '#a855f740',
    previewGrad: 'linear-gradient(135deg, #150a2e, #a855f7)',
  },
];

type AdSize = 'square' | 'story';
const SIZES = {
  square: { w: 1080, h: 1080, label: '1080×1080', labelAr: 'مربع' },
  story: { w: 1080, h: 1920, label: '1080×1920', labelAr: 'ستوري' },
};

export const CourseAdTemplate = ({
  open, onOpenChange, courseId, courseTitle,
  coursePrice, courseDuration, universityName, collegeName,
  majorName, studyYear, subjectName, subjectCode,
  instructorName, slug, thumbnailUrl,
}: CourseAdTemplateProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(0);
  const [adSize, setAdSize] = useState<AdSize>('square');
  const [editData, setEditData] = useState({
    title: courseTitle,
    university: universityName || '',
    college: collegeName || '',
    major: majorName || '',
    studyYear: studyYear || '',
    subjectName: subjectName || '',
    subjectCode: subjectCode || '',
    price: coursePrice?.toString() || '0',
    duration: courseDuration?.toString() || '0',
    instructor: instructorName || '',
    tagline: isRTL ? 'سجّل الآن وابدأ رحلتك التعليمية!' : 'Register now & start learning!',
  });

  useEffect(() => {
    setEditData({
      title: courseTitle,
      university: universityName || '',
      college: collegeName || '',
      major: majorName || '',
      studyYear: studyYear || '',
      subjectName: subjectName || '',
      subjectCode: subjectCode || '',
      price: coursePrice?.toString() || '0',
      duration: courseDuration?.toString() || '0',
      instructor: instructorName || '',
      tagline: isRTL ? 'سجّل الآن وابدأ رحلتك التعليمية!' : 'Register now & start learning!',
    });
  }, [courseTitle, universityName, collegeName, majorName, studyYear, subjectName, subjectCode, coursePrice, courseDuration, instructorName, isRTL]);

  const baseDomain = 'https://www.josoorcom.com';
  const courseUrl = slug ? `${baseDomain}/courses/${slug}` : `${baseDomain}/courses/${courseId}`;

  const drawAd = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sizeConfig = SIZES[adSize];
    const W = sizeConfig.w;
    const H = sizeConfig.h;
    canvas.width = W;
    canvas.height = H;

    const s = STYLES[selectedStyle];
    const margin = 50;

    // ===== BACKGROUND - Rich gradient =====
    const bgG = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bgG.addColorStop(0, s.bg1);
    bgG.addColorStop(0.4, s.bg2);
    bgG.addColorStop(0.7, s.bg3);
    bgG.addColorStop(1, s.bg1);
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, W, H);

    // Subtle diagonal texture lines
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    for (let i = -H; i < W + H; i += 35) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H * 0.6, H); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Ambient glows
    radialGlow(ctx, W * 0.75, H * 0.25, 400, s.glow);
    radialGlow(ctx, W * 0.2, H * 0.75, 350, s.accent + '18');
    radialGlow(ctx, W * 0.5, H * 0.5, 500, s.accent2 + '0a');

    // ===== OUTER FRAME - Premium UI border =====
    ctx.strokeStyle = s.accent + '30';
    ctx.lineWidth = 1.5;
    roundRect(ctx, margin - 5, margin - 5, W - (margin - 5) * 2, H - (margin - 5) * 2, 28);
    ctx.stroke();

    // Inner accent line
    ctx.strokeStyle = s.accent + '15';
    ctx.lineWidth = 1;
    roundRect(ctx, margin + 8, margin + 8, W - (margin + 8) * 2, H - (margin + 8) * 2, 22);
    ctx.stroke();

    // Corner accent dots
    const corners = [
      [margin, margin], [W - margin, margin],
      [margin, H - margin], [W - margin, H - margin]
    ];
    corners.forEach(([cx, cy]) => {
      ctx.fillStyle = s.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // ===== TOP BAR: Logo + Platform =====
    const topY = margin + 20;

    // Accent bar top
    const topBarG = ctx.createLinearGradient(margin, topY - 15, W - margin, topY - 15);
    topBarG.addColorStop(0, s.accent);
    topBarG.addColorStop(0.4, s.accent2);
    topBarG.addColorStop(1, s.accent);
    ctx.fillStyle = topBarG;
    roundRect(ctx, margin, topY - 18, W - margin * 2, 4, 2);
    ctx.fill();

    // Logo
    try {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => { logo.onload = () => res(); logo.onerror = () => rej(); logo.src = logoImg; });
      const ls = 90;
      ctx.shadowColor = s.accent;
      ctx.shadowBlur = 35;
      ctx.drawImage(logo, margin + 15, topY + 10, ls, ls);
      ctx.shadowBlur = 0;
    } catch { /* skip */ }

    // Platform name
    ctx.fillStyle = s.accent;
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isRTL ? 'جسوركم' : 'JOSOORCOM', margin + 120, topY + 55);

    ctx.fillStyle = '#ffffff55';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(isRTL ? 'منصة تعليمية متكاملة' : 'Your Learning Platform', margin + 122, topY + 82);

    // Subject code badge (top right)
    if (editData.subjectCode) {
      ctx.font = 'bold 22px monospace';
      const codeText = editData.subjectCode;
      const codeW = ctx.measureText(codeText).width + 32;
      const codeX = W - margin - codeW - 15;
      const codeY = topY + 25;

      ctx.shadowColor = s.accent;
      ctx.shadowBlur = 15;
      roundRect(ctx, codeX, codeY, codeW, 42, 21);
      ctx.fillStyle = s.accent + 'cc';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = s.accent;
      ctx.lineWidth = 1.5;
      roundRect(ctx, codeX, codeY, codeW, 42, 21);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(codeText, codeX + codeW / 2, codeY + 30);
    }

    // Separator below top bar
    const sep1Y = topY + 110;
    const sepG = ctx.createLinearGradient(margin + 20, sep1Y, W - margin - 20, sep1Y);
    sepG.addColorStop(0, s.accent + '66');
    sepG.addColorStop(0.5, s.accent2 + '44');
    sepG.addColorStop(1, s.accent + '22');
    ctx.strokeStyle = sepG;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(margin + 20, sep1Y);
    ctx.lineTo(W - margin - 20, sep1Y);
    ctx.stroke();

    // Diamond on separator
    ctx.fillStyle = s.accent2;
    ctx.save();
    ctx.translate(W / 2, sep1Y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();

    // ===== THUMBNAIL (compact, right-aligned) =====
    const imgW = 420;
    const imgH = 300;
    const imgX = W - margin - imgW - 20;
    const imgY = sep1Y + 30;

    // Glow behind image
    ctx.shadowColor = s.accent;
    ctx.shadowBlur = 40;
    roundRect(ctx, imgX - 3, imgY - 3, imgW + 6, imgH + 6, 20);
    ctx.fillStyle = s.accent + '15';
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    roundRect(ctx, imgX, imgY, imgW, imgH, 18);
    ctx.clip();

    if (thumbnailUrl) {
      try {
        const thumb = new Image();
        thumb.crossOrigin = 'anonymous';
        await new Promise<void>((res, rej) => { thumb.onload = () => res(); thumb.onerror = () => rej(); thumb.src = thumbnailUrl; });
        const scale = Math.max(imgW / thumb.width, imgH / thumb.height);
        const dw = thumb.width * scale, dh = thumb.height * scale;
        ctx.drawImage(thumb, imgX + (imgW - dw) / 2, imgY + (imgH - dh) / 2, dw, dh);
      } catch {
        drawPlaceholder(ctx, imgX, imgY, imgW, imgH, s);
      }
    } else {
      drawPlaceholder(ctx, imgX, imgY, imgW, imgH, s);
    }

    // Scan line effect
    ctx.globalAlpha = 0.06;
    for (let y = imgY; y < imgY + imgH; y += 3) {
      ctx.fillStyle = '#000';
      ctx.fillRect(imgX, y, imgW, 1);
    }
    ctx.globalAlpha = 1;

    // Bottom gradient overlay
    const ovG = ctx.createLinearGradient(imgX, imgY + imgH * 0.6, imgX, imgY + imgH);
    ovG.addColorStop(0, 'transparent');
    ovG.addColorStop(1, s.bg1 + 'dd');
    ctx.fillStyle = ovG;
    ctx.fillRect(imgX, imgY, imgW, imgH);
    ctx.restore();

    // Border
    ctx.strokeStyle = s.accent + '55';
    ctx.lineWidth = 2;
    roundRect(ctx, imgX, imgY, imgW, imgH, 18);
    ctx.stroke();

    // Corner brackets
    const bLen = 30, bOff = 8;
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 2.5;
    [[imgX + bOff, imgY + bOff, 1, 1], [imgX + imgW - bOff, imgY + bOff, -1, 1],
     [imgX + bOff, imgY + imgH - bOff, 1, -1], [imgX + imgW - bOff, imgY + imgH - bOff, -1, -1]
    ].forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x + bLen * dx, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + bLen * dy);
      ctx.stroke();
    });

    // ===== COURSE TITLE (left side, big) =====
    let curY = sep1Y + 45;
    const titleMaxW = imgX - margin - 50;

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 48px Arial, sans-serif';
    const titleLines = wrapText(ctx, editData.title, titleMaxW);
    titleLines.slice(0, 4).forEach((line) => {
      ctx.fillText(line, margin + 20, curY);
      curY += 58;
    });

    // Subject name below title
    if (editData.subjectName) {
      curY += 5;
      ctx.fillStyle = s.accent2;
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(editData.subjectName, margin + 20, curY);
      curY += 40;
    }

    // Instructor
    if (editData.instructor) {
      curY += 2;
      ctx.fillStyle = '#ffffffaa';
      ctx.font = '22px Arial, sans-serif';
      const instrText = `👨‍🏫 ${editData.instructor}`;
      ctx.fillText(instrText, margin + 20, curY);
      curY += 35;
    }

    // ===== ACADEMIC INFO SECTION =====
    const infoY = imgY + imgH + 30;
    const infoItems: { icon: string; value: string }[] = [];
    if (editData.university) infoItems.push({ icon: '🏛️', value: editData.university });
    if (editData.college) infoItems.push({ icon: '🎓', value: editData.college });
    if (editData.major) infoItems.push({ icon: '📚', value: editData.major });
    if (editData.studyYear) infoItems.push({ icon: '📅', value: `${isRTL ? 'السنة' : 'Year'} ${editData.studyYear}` });

    if (infoItems.length > 0) {
      const colW = (W - margin * 2 - 60) / 2;
      const rowH = 48;

      infoItems.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margin + 20 + col * (colW + 20);
        const y = infoY + row * rowH;

        // Row background
        const rowG = ctx.createLinearGradient(x, y, x + colW, y);
        rowG.addColorStop(0, s.accent + '14');
        rowG.addColorStop(1, s.accent + '06');
        ctx.fillStyle = rowG;
        roundRect(ctx, x, y - 14, colW, 40, 10);
        ctx.fill();

        ctx.strokeStyle = s.accent + '22';
        ctx.lineWidth = 1;
        roundRect(ctx, x, y - 14, colW, 40, 10);
        ctx.stroke();

        // Left accent
        ctx.fillStyle = s.accent;
        roundRect(ctx, x, y - 14, 3, 40, 1);
        ctx.fill();

        // Icon + value
        ctx.font = '20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(item.icon, x + 12, y + 8);

        ctx.fillStyle = '#ffffffdd';
        ctx.font = 'bold 20px Arial, sans-serif';
        const val = item.value.length > 24 ? item.value.slice(0, 23) + '..' : item.value;
        ctx.fillText(val, x + 42, y + 9);
      });
    }

    // ===== BOTTOM SECTION =====
    const bottomZone = H - margin - 20;

    // Stats pills (left side bottom)
    const statsY = bottomZone - 95;
    const statsItems: string[] = [];
    if (Number(editData.price) === 0) {
      statsItems.push(`💰 ${isRTL ? 'مجاني' : 'Free'}`);
    } else {
      statsItems.push(`💰 ${editData.price} ${isRTL ? 'ر.س' : 'SAR'}`);
    }
    statsItems.push(`⏱️ ${editData.duration} ${isRTL ? 'ساعة' : 'hrs'}`);

    ctx.font = 'bold 22px Arial, sans-serif';
    let stX = margin + 20;
    statsItems.forEach((st) => {
      const tw = ctx.measureText(st).width + 28;
      
      ctx.shadowColor = s.accent;
      ctx.shadowBlur = 10;
      roundRect(ctx, stX, statsY, tw, 38, 19);
      ctx.fillStyle = s.accent + '25';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = s.accent + '55';
      ctx.lineWidth = 1.5;
      roundRect(ctx, stX, statsY, tw, 38, 19);
      ctx.stroke();

      ctx.fillStyle = '#ffffffee';
      ctx.textAlign = 'left';
      ctx.fillText(st, stX + 14, statsY + 27);
      stX += tw + 14;
    });

    // Tagline
    ctx.fillStyle = s.accent;
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(editData.tagline, margin + 20, bottomZone - 30);

    // Website
    ctx.fillStyle = '#ffffff66';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('www.josoorcom.com', margin + 20, bottomZone);

    // ===== QR CODE (bottom right, big with glow) =====
    const qrSvg = qrRef.current?.querySelector('svg');
    if (qrSvg) {
      const svgData = new XMLSerializer().serializeToString(qrSvg);
      const qrImg = new Image();
      await new Promise<void>((res) => { qrImg.onload = () => res(); qrImg.onerror = () => res(); qrImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData))); });

      const qrSize = 180;
      const qrPad = 14;
      const qrX = W - margin - qrSize - qrPad * 2 - 15;
      const qrY = bottomZone - qrSize - qrPad * 2 - 35;

      // Neon glow
      ctx.shadowColor = s.accent;
      ctx.shadowBlur = 35;
      roundRect(ctx, qrX, qrY, qrSize + qrPad * 2, qrSize + qrPad * 2, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Accent border
      ctx.strokeStyle = s.accent;
      ctx.lineWidth = 3;
      roundRect(ctx, qrX, qrY, qrSize + qrPad * 2, qrSize + qrPad * 2, 18);
      ctx.stroke();

      // Second glow ring
      ctx.strokeStyle = s.accent + '33';
      ctx.lineWidth = 1.5;
      roundRect(ctx, qrX - 6, qrY - 6, qrSize + qrPad * 2 + 12, qrSize + qrPad * 2 + 12, 22);
      ctx.stroke();

      ctx.drawImage(qrImg, qrX + qrPad, qrY + qrPad, qrSize, qrSize);

      // Scan label
      ctx.fillStyle = s.accent;
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isRTL ? '📱 امسح للتسجيل' : '📱 Scan to enroll', qrX + (qrSize + qrPad * 2) / 2, qrY + qrSize + qrPad * 2 + 22);
    }

    // ===== BOTTOM ACCENT BAR =====
    const btmBarG = ctx.createLinearGradient(0, H - 6, W, H);
    btmBarG.addColorStop(0, s.accent);
    btmBarG.addColorStop(0.5, s.accent2);
    btmBarG.addColorStop(1, s.accent);
    ctx.fillStyle = btmBarG;
    ctx.fillRect(0, H - 5, W, 5);

    // Top accent bar
    ctx.fillStyle = btmBarG;
    ctx.fillRect(0, 0, W, 5);

  }, [selectedStyle, editData, courseId, courseUrl, isRTL, thumbnailUrl, adSize]);

  useEffect(() => {
    if (open) setTimeout(() => drawAd(), 150);
  }, [open, drawAd]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `course-ad-${slug || courseId}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    toast.success(isRTL ? 'تم تحميل صورة الإعلان' : 'Ad image downloaded');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            {isRTL ? 'صورة إعلان الكورس' : 'Course Ad Image'}
          </DialogTitle>
        </DialogHeader>

        <div ref={qrRef} className="hidden">
          <QRCodeSVG value={courseUrl} size={250} level="H" bgColor="#ffffff" fgColor="#000000" />
        </div>

        <div className="space-y-4">
          {/* Size & Style selectors */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">{isRTL ? 'المقاس:' : 'Size:'}</span>
              <div className="flex gap-2">
                {(Object.entries(SIZES) as [AdSize, typeof SIZES['square']][]).map(([key, size]) => (
                  <button
                    key={key}
                    onClick={() => { setAdSize(key); setTimeout(() => drawAd(), 50); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      adSize === key ? 'border-primary bg-primary/10 text-primary' : 'border-muted text-muted-foreground'
                    }`}
                  >
                    {isRTL ? size.labelAr : size.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{isRTL ? 'الستايل:' : 'Style:'}</span>
              <div className="flex gap-2">
                {STYLES.map((style, i) => (
                  <button
                    key={style.id}
                    onClick={() => { setSelectedStyle(i); setTimeout(() => drawAd(), 50); }}
                    className={`w-9 h-9 rounded-full border-2 transition-all ${
                      selectedStyle === i ? 'border-primary scale-110 ring-2 ring-primary/30' : 'border-muted'
                    }`}
                    style={{ background: style.previewGrad }}
                    title={style.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Canvas preview */}
          <div className="rounded-xl overflow-hidden border bg-muted/30 shadow-lg mx-auto" style={{ maxWidth: adSize === 'story' ? '280px' : '450px' }}>
            <canvas ref={canvasRef} className="w-full h-auto" />
          </div>

          {/* Edit toggle */}
          <Button
            variant={isEditing ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <Eye className="w-4 h-4 me-1" /> : <Edit className="w-4 h-4 me-1" />}
            {isEditing ? (isRTL ? 'معاينة' : 'Preview') : (isRTL ? 'تعديل المحتوى' : 'Edit Content')}
          </Button>

          {/* Edit form */}
          {isEditing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-lg border bg-muted/20 text-sm">
              <div className="md:col-span-2">
                <Label className="text-xs">{isRTL ? 'عنوان الكورس' : 'Title'}</Label>
                <Input value={editData.title} onChange={(e) => setEditData(d => ({ ...d, title: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'الجامعة' : 'University'}</Label>
                <Input value={editData.university} onChange={(e) => setEditData(d => ({ ...d, university: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'الكلية' : 'College'}</Label>
                <Input value={editData.college} onChange={(e) => setEditData(d => ({ ...d, college: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'التخصص' : 'Major'}</Label>
                <Input value={editData.major} onChange={(e) => setEditData(d => ({ ...d, major: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'السنة الدراسية' : 'Study Year'}</Label>
                <Input value={editData.studyYear} onChange={(e) => setEditData(d => ({ ...d, studyYear: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'اسم المادة' : 'Subject'}</Label>
                <Input value={editData.subjectName} onChange={(e) => setEditData(d => ({ ...d, subjectName: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'رمز المادة' : 'Code'}</Label>
                <Input value={editData.subjectCode} onChange={(e) => setEditData(d => ({ ...d, subjectCode: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'السعر' : 'Price'}</Label>
                <Input value={editData.price} onChange={(e) => setEditData(d => ({ ...d, price: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'المدة (ساعات)' : 'Duration'}</Label>
                <Input value={editData.duration} onChange={(e) => setEditData(d => ({ ...d, duration: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'المحاضر' : 'Instructor'}</Label>
                <Input value={editData.instructor} onChange={(e) => setEditData(d => ({ ...d, instructor: e.target.value }))} onBlur={() => drawAd()} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">{isRTL ? 'النص الترويجي' : 'Tagline'}</Label>
                <Input value={editData.tagline} onChange={(e) => setEditData(d => ({ ...d, tagline: e.target.value }))} onBlur={() => drawAd()} />
              </div>
            </div>
          )}

          {/* Download */}
          <Button onClick={handleDownload} className="w-full" size="lg">
            <Download className="w-4 h-4 me-2" />
            {isRTL ? `تحميل الإعلان PNG (${SIZES[adSize].label})` : `Download Ad PNG (${SIZES[adSize].label})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ===== Helpers =====

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  words.forEach((w) => {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  });
  if (cur) lines.push(cur);
  return lines;
}

function radialGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: { accent: string; bg1: string }) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, s.accent + '33');
  g.addColorStop(1, s.bg1);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = s.accent + '44';
  ctx.font = '90px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🎓', x + w / 2, y + h / 2 + 35);
}
