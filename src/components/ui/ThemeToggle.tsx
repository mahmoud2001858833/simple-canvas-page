import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  isScrolled?: boolean;
}

export function ThemeToggle({ isScrolled = true }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={isScrolled ? '' : 'text-white hover:bg-white/10'}
      >
        <Sun className="w-5 h-5" />
      </Button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative overflow-hidden transition-all duration-300 ${
        isScrolled 
          ? 'hover:bg-primary/10 hover:text-primary' 
          : 'text-white hover:bg-white/10'
      }`}
    >
      <Sun 
        className={`absolute w-5 h-5 transition-all duration-500 ${
          isDark 
            ? 'rotate-90 scale-0 opacity-0' 
            : 'rotate-0 scale-100 opacity-100'
        }`} 
      />
      <Moon 
        className={`absolute w-5 h-5 transition-all duration-500 ${
          isDark 
            ? 'rotate-0 scale-100 opacity-100' 
            : '-rotate-90 scale-0 opacity-0'
        }`} 
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
