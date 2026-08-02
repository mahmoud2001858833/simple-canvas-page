import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import logo from '@/assets/logo.png';

interface VideoWatermarkProps {
  enabled: boolean;
}

export const VideoWatermark = ({ enabled }: VideoWatermarkProps) => {
  const { user, profile } = useAuth();
  const [positions, setPositions] = useState<{ top: string; left: string }[]>([]);

  useEffect(() => {
    if (!enabled) return;

    // Generate random positions for watermarks
    const generatePositions = () => {
      const newPositions = [];
      for (let i = 0; i < 4; i++) {
        newPositions.push({
          top: `${15 + Math.random() * 70}%`,
          left: `${10 + Math.random() * 80}%`,
        });
      }
      setPositions(newPositions);
    };

    generatePositions();
    
    // Change positions periodically to make removal harder
    const interval = setInterval(generatePositions, 8000);
    
    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled || !user) return null;

  const phone = profile?.phone?.trim();
  const userIdentifier = phone || profile?.email || user.email || user.id.slice(0, 8);
  const secondaryIdentifier = phone ? (profile?.email || user.email || '') : '';
  const timestamp = new Date().toISOString().slice(0, 16);
  const platformName = 'جسوركم';


  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[9999]">
      {/* Semi-transparent watermarks at random positions - LARGER SIZE */}
      {positions.map((pos, index) => (
        <div
          key={index}
          className="absolute text-white/20 font-mono select-none transform -rotate-12 whitespace-nowrap flex flex-col items-center"
          style={{
            top: pos.top,
            left: pos.left,
            textShadow: '0 0 3px rgba(0,0,0,0.5)',
            fontSize: 'clamp(12px, 2vw, 18px)',
            letterSpacing: '1px',
          }}
        >
          <img 
            src={logo} 
            alt="" 
            className="opacity-20"
            style={{ 
              width: 'clamp(24px, 4vw, 40px)', 
              height: 'clamp(24px, 4vw, 40px)',
              marginBottom: '4px',
            }} 
          />
          <div>{userIdentifier}</div>
          <div className="text-white/15 text-center" style={{ fontSize: 'clamp(10px, 1.5vw, 14px)' }}>{platformName}</div>
        </div>
      ))}
      
      {/* Corner watermark - bottom right with logo */}
      <div 
        className="absolute flex items-center gap-2 text-white/25 font-mono select-none"
        style={{
          bottom: 'clamp(12px, 3vw, 60px)',
          right: 'clamp(12px, 3vw, 60px)',
          fontSize: 'clamp(12px, 2vw, 18px)',
        }}
      >
        <img 
          src={logo} 
          alt="" 
          className="opacity-30"
          style={{ 
            width: 'clamp(32px, 5vw, 50px)', 
            height: 'clamp(32px, 5vw, 50px)',
          }} 
        />
        <div className="text-right">
          <div>{userIdentifier}</div>
          <div className="text-white/20" style={{ fontSize: 'clamp(10px, 1.5vw, 14px)' }}>{platformName} • {timestamp}</div>
        </div>
      </div>
      
      {/* Corner watermark - top left with logo */}
      <div 
        className="absolute flex items-center gap-2 text-white/20 font-mono select-none"
        style={{
          top: 'clamp(12px, 3vw, 60px)',
          left: 'clamp(12px, 3vw, 60px)',
          fontSize: 'clamp(11px, 1.8vw, 16px)',
        }}
      >
        <img 
          src={logo} 
          alt="" 
          className="opacity-25"
          style={{ 
            width: 'clamp(28px, 4vw, 45px)', 
            height: 'clamp(28px, 4vw, 45px)',
          }} 
        />
        <div>
          <div>ID: {user.id.slice(0, 12)}</div>
          <div className="text-white/15" style={{ fontSize: 'clamp(9px, 1.4vw, 13px)' }}>{platformName}</div>
        </div>
      </div>

      {/* Center watermark - visible in fullscreen with logo */}
      <div 
        className="absolute flex flex-col items-center text-white/10 font-mono select-none transform -rotate-45 whitespace-nowrap"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-45deg)',
          fontSize: 'clamp(14px, 3vw, 24px)',
          letterSpacing: '2px',
        }}
      >
        <img 
          src={logo} 
          alt="" 
          className="opacity-15"
          style={{ 
            width: 'clamp(40px, 6vw, 70px)', 
            height: 'clamp(40px, 6vw, 70px)',
            marginBottom: '8px',
          }} 
        />
        <div>{userIdentifier}</div>
        <div className="text-white/8 text-center" style={{ fontSize: 'clamp(12px, 2.5vw, 20px)' }}>{platformName}</div>
      </div>

      {/* Invisible watermark pattern - harder to remove */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 100px,
            rgba(255,255,255,0.02) 100px,
            rgba(255,255,255,0.02) 200px
          )`,
        }}
      />
    </div>
  );
};
