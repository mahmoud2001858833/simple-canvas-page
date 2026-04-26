// قيود رفع الفيديو
export const VIDEO_CONSTRAINTS = {
  maxSize: 2 * 1024 * 1024 * 1024, // 2GB in bytes
  maxSizeLabel: '2GB',
  maxSizeMB: 2048,
  allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
  allowedExtensions: ['mp4', 'webm', 'mov'] as const,
};

export interface VideoValidationResult {
  valid: boolean;
  error?: {
    en: string;
    ar: string;
  };
}

export function validateVideoFile(file: File): VideoValidationResult {
  // Check file size
  if (file.size > VIDEO_CONSTRAINTS.maxSize) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: {
        en: `File too large (${fileSizeMB}MB). Maximum allowed: ${VIDEO_CONSTRAINTS.maxSizeLabel}`,
        ar: `الملف كبير جداً (${fileSizeMB}MB). الحد الأقصى المسموح: ${VIDEO_CONSTRAINTS.maxSizeLabel}`,
      },
    };
  }

  // Check file type
  const isValidType = VIDEO_CONSTRAINTS.allowedTypes.includes(file.type as any);
  
  // Also check extension as fallback
  const extension = file.name.split('.').pop()?.toLowerCase();
  const isValidExtension = extension && VIDEO_CONSTRAINTS.allowedExtensions.includes(extension as any);

  if (!isValidType && !isValidExtension) {
    const allowedList = VIDEO_CONSTRAINTS.allowedExtensions.map(ext => ext.toUpperCase()).join(', ');
    return {
      valid: false,
      error: {
        en: `Unsupported file format. Allowed formats: ${allowedList}`,
        ar: `صيغة الملف غير مدعومة. الصيغ المسموحة: ${allowedList}`,
      },
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getVideoAcceptString(): string {
  return VIDEO_CONSTRAINTS.allowedTypes.join(',') + ',' + 
    VIDEO_CONSTRAINTS.allowedExtensions.map(ext => `.${ext}`).join(',');
}
