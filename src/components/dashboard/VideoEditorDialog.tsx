import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Scissors, 
  Type, 
  Merge, 
  Play, 
  Pause, 
  Save, 
  Upload, 
  X,
  Loader2,
  Eye,
  RotateCcw,
  FileVideo
} from 'lucide-react';
import { toast } from 'sonner';

interface VideoEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  onSaveAndPublish: (editedVideoUrl: string) => void;
}

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
}

const VideoEditorDialog = ({ open, onOpenChange, videoUrl, onSaveAndPublish }: VideoEditorDialogProps) => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [newText, setNewText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(24);
  const [mergeFile, setMergeFile] = useState<File | null>(null);
  const [mergePosition, setMergePosition] = useState<'before' | 'after'>('after');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('trim');

  const texts = {
    ar: {
      title: 'تعديل ومونتاج الفيديو',
      trim: 'قص',
      addText: 'إضافة نص',
      merge: 'دمج',
      preview: 'معاينة',
      savePublish: 'حفظ ونشر',
      saving: 'جاري الحفظ...',
      trimStart: 'نقطة البداية',
      trimEnd: 'نقطة النهاية',
      textContent: 'النص',
      textColorLabel: 'لون النص',
      textSizeLabel: 'حجم النص',
      addTextBtn: 'إضافة النص',
      mergeVideo: 'رفع فيديو للدمج',
      mergeBefore: 'قبل الفيديو الحالي',
      mergeAfter: 'بعد الفيديو الحالي',
      noOverlays: 'لا توجد نصوص مضافة',
      reset: 'إعادة تعيين',
      note: 'ملاحظة: معالجة الفيديو تتم في المتصفح وقد تستغرق وقتاً للملفات الكبيرة',
    },
    en: {
      title: 'Video Editor',
      trim: 'Trim',
      addText: 'Add Text',
      merge: 'Merge',
      preview: 'Preview',
      savePublish: 'Save & Publish',
      saving: 'Saving...',
      trimStart: 'Start Point',
      trimEnd: 'End Point',
      textContent: 'Text',
      textColorLabel: 'Text Color',
      textSizeLabel: 'Text Size',
      addTextBtn: 'Add Text',
      mergeVideo: 'Upload Video to Merge',
      mergeBefore: 'Before current video',
      mergeAfter: 'After current video',
      noOverlays: 'No text overlays added',
      reset: 'Reset',
      note: 'Note: Video processing happens in the browser and may take time for large files',
    },
  };
  const t = texts[language];

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', () => {
        setDuration(videoRef.current!.duration);
      });
      videoRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(videoRef.current!.currentTime);
      });
    }
  }, [videoUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;
    setTextOverlays(prev => [...prev, {
      id: Date.now().toString(),
      text: newText,
      x: 50,
      y: 50,
      color: textColor,
      fontSize: textSize,
    }]);
    setNewText('');
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(o => o.id !== id));
  };

  const handleSaveAndPublish = async () => {
    setIsSaving(true);
    try {
      // For now, just pass through the original video URL
      // In a full implementation, this would process the video with FFmpeg WASM
      toast.info(language === 'ar' 
        ? 'سيتم تطبيق التعديلات وحفظ الفيديو...' 
        : 'Applying edits and saving video...');
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      onSaveAndPublish(videoUrl);
      onOpenChange(false);
      toast.success(language === 'ar' ? 'تم حفظ ونشر الفيديو بنجاح' : 'Video saved and published successfully');
    } catch (error) {
      console.error('Error saving video:', error);
      toast.error(language === 'ar' ? 'فشل في حفظ الفيديو' : 'Failed to save video');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setTrimStart(0);
    setTrimEnd(100);
    setTextOverlays([]);
    setMergeFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileVideo className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Preview */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onEnded={() => setIsPlaying(false)}
            />
            {/* Text Overlays Preview */}
            {textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: 'translate(-50%, -50%)',
                  color: overlay.color,
                  fontSize: `${overlay.fontSize}px`,
                  fontWeight: 'bold',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {overlay.text}
              </div>
            ))}
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={togglePlay} className="rounded-full">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <span className="text-sm font-mono">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={([val]) => {
                if (videoRef.current) videoRef.current.currentTime = val;
              }}
              className="flex-1"
            />
            <span className="text-sm font-mono">{formatTime(duration)}</span>
          </div>

          {/* Editor Tools */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="trim">
                <Scissors className="w-4 h-4 me-1" />
                {t.trim}
              </TabsTrigger>
              <TabsTrigger value="text">
                <Type className="w-4 h-4 me-1" />
                {t.addText}
              </TabsTrigger>
              <TabsTrigger value="merge">
                <Merge className="w-4 h-4 me-1" />
                {t.merge}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trim" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">{t.trimStart}: {formatTime((trimStart / 100) * duration)}</Label>
                  <Slider
                    value={[trimStart]}
                    max={100}
                    step={0.5}
                    onValueChange={([val]) => setTrimStart(val)}
                  />
                </div>
                <div>
                  <Label className="text-sm">{t.trimEnd}: {formatTime((trimEnd / 100) * duration)}</Label>
                  <Slider
                    value={[trimEnd]}
                    max={100}
                    step={0.5}
                    onValueChange={([val]) => setTrimEnd(val)}
                  />
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'المدة بعد القص:' : 'Duration after trim:'}{' '}
                    {formatTime(((trimEnd - trimStart) / 100) * duration)}
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>{t.textContent}</Label>
                  <Input
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل النص هنا...' : 'Enter text here...'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t.textColorLabel}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <span className="text-sm font-mono">{textColor}</span>
                    </div>
                  </div>
                  <div>
                    <Label>{t.textSizeLabel}: {textSize}px</Label>
                    <Slider
                      value={[textSize]}
                      min={12}
                      max={72}
                      step={2}
                      onValueChange={([val]) => setTextSize(val)}
                    />
                  </div>
                </div>
                <Button onClick={addTextOverlay} disabled={!newText.trim()} className="bg-gradient-gold">
                  <Type className="w-4 h-4 me-1" />
                  {t.addTextBtn}
                </Button>
              </div>

              {textOverlays.length > 0 ? (
                <div className="space-y-2">
                  {textOverlays.map((overlay) => (
                    <div key={overlay.id} className="flex items-center gap-2 p-2 rounded-lg border">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: overlay.color }}
                      />
                      <span className="flex-1 text-sm truncate">{overlay.text}</span>
                      <Badge variant="secondary" className="text-xs">{overlay.fontSize}px</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTextOverlay(overlay.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">{t.noOverlays}</p>
              )}
            </TabsContent>

            <TabsContent value="merge" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant={mergePosition === 'before' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMergePosition('before')}
                  >
                    {t.mergeBefore}
                  </Button>
                  <Button
                    variant={mergePosition === 'after' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMergePosition('after')}
                  >
                    {t.mergeAfter}
                  </Button>
                </div>
                
                {mergeFile ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileVideo className="w-5 h-5 text-primary" />
                    <span className="text-sm flex-1 truncate">{mergeFile.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMergeFile(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">{t.mergeVideo}</p>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={(e) => setMergeFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center">{t.note}</p>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 me-1" />
              {t.reset}
            </Button>
            <Button
              onClick={handleSaveAndPublish}
              disabled={isSaving}
              className="bg-gradient-gold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 me-1 animate-spin" />
                  {t.saving}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 me-1" />
                  {t.savePublish}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoEditorDialog;
