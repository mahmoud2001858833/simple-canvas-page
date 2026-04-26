const AnimatedBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient mesh background - More Green */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-900 to-green-950 opacity-95" />
      
      {/* Static gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 0%, hsl(155 50% 8% / 0.8) 100%)',
        }}
      />

      {/* Gold orb - larger and more prominent */}
      <div 
        className="absolute rounded-full blur-3xl animate-pulse"
        style={{
          left: '15%',
          top: '25%',
          width: 280,
          height: 280,
          background: 'radial-gradient(circle, hsl(45, 90%, 55%) 0%, hsl(38, 85%, 45%) 40%, transparent 70%)',
          opacity: 0.35,
        }}
      />
      
      {/* Green orb - enhanced */}
      <div 
        className="absolute rounded-full blur-3xl animate-pulse"
        style={{
          left: '65%',
          top: '15%',
          width: 250,
          height: 250,
          background: 'radial-gradient(circle, hsl(155, 65%, 45%) 0%, hsl(160, 60%, 35%) 40%, transparent 70%)',
          opacity: 0.3,
          animationDelay: '0.5s',
        }}
      />
      
      {/* Second gold orb */}
      <div 
        className="absolute rounded-full blur-3xl animate-pulse"
        style={{
          left: '75%',
          top: '55%',
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, hsl(45, 85%, 50%) 0%, transparent 70%)',
          opacity: 0.25,
          animationDelay: '1.5s',
        }}
      />
      
      {/* Blue accent orb - subtle */}
      <div 
        className="absolute rounded-full blur-3xl animate-pulse"
        style={{
          left: '40%',
          top: '70%',
          width: 180,
          height: 180,
          background: 'radial-gradient(circle, hsl(210, 75%, 50%) 0%, transparent 70%)',
          opacity: 0.15,
          animationDelay: '2s',
        }}
      />
      
      {/* Emerald/Teal orb */}
      <div 
        className="absolute rounded-full blur-3xl animate-pulse"
        style={{
          left: '10%',
          top: '65%',
          width: 220,
          height: 220,
          background: 'radial-gradient(circle, hsl(160, 55%, 40%) 0%, hsl(175, 60%, 35%) 40%, transparent 70%)',
          opacity: 0.25,
          animationDelay: '1s',
        }}
      />

      {/* Grid pattern overlay - Gold tinted */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(45, 85%, 50%) 1px, transparent 1px),
            linear-gradient(90deg, hsl(45, 85%, 50%) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* Subtle green accent lines */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(45deg, hsl(155, 60%, 45%) 1px, transparent 1px)
          `,
          backgroundSize: '120px 120px',
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
