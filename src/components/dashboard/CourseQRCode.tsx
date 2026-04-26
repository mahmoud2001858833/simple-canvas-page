import { useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy, Download, QrCode, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface CourseQRCodeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  slug?: string;
}

export const CourseQRCode = ({ open, onOpenChange, courseId, courseTitle, slug }: CourseQRCodeProps) => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const qrRef = useRef<HTMLDivElement>(null);

  const baseDomain = 'https://www.josoorcom.com';
  const courseUrl = slug
    ? `${baseDomain}/courses/${slug}`
    : `${baseDomain}/courses/${courseId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(courseUrl);
    toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    canvas.width = 400;
    canvas.height = 400;

    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 400, 400);
      const link = document.createElement('a');
      link.download = `course-qr-${slug || courseId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success(language === 'ar' ? 'تم تحميل الباركود' : 'QR code downloaded');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            {language === 'ar' ? 'رابط وباركود البرنامج' : 'Course Link & QR Code'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground text-center">{courseTitle}</p>

          <div className="flex items-center justify-center gap-4">
            <div ref={qrRef} className="flex justify-center p-4 bg-white rounded-xl">
              <QRCodeSVG
                value={courseUrl}
                size={200}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-xs text-muted-foreground">{language === 'ar' ? 'رقم الدورة' : 'Course ID'}</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded select-all break-all max-w-[100px]">{courseId.slice(0, 8)}</span>
              <span className="text-xs text-muted-foreground mt-2">{language === 'ar' ? 'الدومين' : 'Domain'}</span>
              <span className="text-xs font-medium text-primary">josoorcom.com</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={courseUrl}
                readOnly
                className="ps-9 text-xs"
                dir="ltr"
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleCopyLink}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <Button onClick={handleDownloadQR} className="w-full bg-gradient-gold">
            <Download className="w-4 h-4 me-2" />
            {language === 'ar' ? 'تحميل الباركود' : 'Download QR Code'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
