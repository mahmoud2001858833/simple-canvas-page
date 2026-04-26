import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import { Globe, Menu, X, User, LogOut, LayoutDashboard } from 'lucide-react';
import logo from '@/assets/logo.png';
import { GlobalSearch } from '@/components/landing/GlobalSearch';

const Navbar = () => {
  const { t, language, setLanguage, dir } = useLanguage();
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { scrollToElement } = useSmoothScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Update active section based on scroll position
      if (location.pathname === '/') {
        const sections = ['how-it-works', 'features', 'universities', 'testimonials', 'faq'];
        for (const section of sections) {
          const element = document.getElementById(section);
          if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.top <= 150 && rect.bottom >= 150) {
              setActiveSection(section);
              break;
            }
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const handleNavClick = (href: string, sectionId?: string) => {
    if (sectionId && location.pathname === '/') {
      scrollToElement(sectionId, { offset: -80, duration: 800 });
      setIsMobileMenuOpen(false);
    } else if (sectionId) {
      navigate('/');
      setTimeout(() => {
        scrollToElement(sectionId, { offset: -80, duration: 800 });
      }, 100);
      setIsMobileMenuOpen(false);
    }
  };

  const getDashboardPath = () => {
    if (role === 'admin') return '/admin';
    if (role === 'instructor') return '/instructor';
    return '/dashboard';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { label: t.nav.home, href: '/', sectionId: undefined },
    { label: t.nav.courses, href: '/courses', sectionId: undefined },
    { label: dir === 'rtl' ? 'من نحن' : 'About Us', href: '/about', sectionId: undefined },
    { label: dir === 'rtl' ? 'كيف يعمل' : 'How It Works', href: '/#how-it-works', sectionId: 'how-it-works' },
    { label: dir === 'rtl' ? 'الأسئلة الشائعة' : 'FAQ', href: '/#faq', sectionId: 'faq' },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-elegant'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.img
              src={logo}
              alt="Logo"
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-contain bg-white/10 p-1.5 shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            />
            <span className={`text-2xl md:text-3xl font-bold transition-colors ${
              isScrolled ? 'text-gradient-gold' : 'text-white'
            }`}>
              {t.hero.title}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link, index) => (
              link.sectionId ? (
                <button
                  key={index}
                  onClick={() => handleNavClick(link.href, link.sectionId)}
                  className={`relative font-medium transition-colors group cursor-pointer ${
                    activeSection === link.sectionId
                    ? 'text-accent'
                      : isScrolled 
                        ? 'text-foreground/80 hover:text-accent' 
                        : 'text-white/80 hover:text-accent'
                  }`}
                >
                  {link.label}
                  <span className={`absolute -bottom-1 left-0 h-0.5 bg-accent transition-all duration-300 ${
                    activeSection === link.sectionId ? 'w-full' : 'w-0 group-hover:w-full'
                  }`} />
                </button>
              ) : (
                <Link
                  key={index}
                  to={link.href}
                  className={`relative font-medium transition-colors group ${
                    isScrolled ? 'text-foreground/80 hover:text-accent' : 'text-white/80 hover:text-accent'
                  }`}
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-300" />
                </Link>
              )
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Global Search */}
            <div className="hidden md:block">
              <GlobalSearch isScrolled={isScrolled} />
            </div>

            {/* Theme Toggle */}
            <ThemeToggle isScrolled={isScrolled} />

            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className={`transition-all duration-300 ${
                isScrolled 
                  ? 'hover:bg-accent/10 hover:text-accent' 
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Globe className="w-5 h-5" />
            </Button>

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <Link to={getDashboardPath()}>
                    <Button 
                      variant="ghost"
                      className={`gap-2 ${isScrolled ? '' : 'text-white hover:bg-white/10'}`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      {t.nav.dashboard || 'لوحة التحكم'}
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost"
                    onClick={handleSignOut}
                    className={`gap-2 ${isScrolled ? '' : 'text-white hover:bg-white/10'}`}
                  >
                    <LogOut className="w-4 h-4" />
                    {t.nav.logout || 'تسجيل الخروج'}
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button 
                      variant="ghost"
                      className={isScrolled ? '' : 'text-white hover:bg-white/10'}
                    >
                      {t.nav.login}
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button className="btn-gold">
                      {t.nav.signup}
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={`md:hidden ${isScrolled ? '' : 'text-white hover:bg-white/10'}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-t border-border/50"
          >
            <div className="container mx-auto px-4 py-6 space-y-4">
              {navLinks.map((link, index) => (
                link.sectionId ? (
                  <button
                    key={index}
                    onClick={() => handleNavClick(link.href, link.sectionId)}
                    className={`block w-full text-start py-2 transition-colors ${
                      activeSection === link.sectionId
                        ? 'text-accent font-medium'
                        : 'text-foreground/80 hover:text-accent'
                    }`}
                  >
                    {link.label}
                  </button>
                ) : (
                  <Link
                    key={index}
                    to={link.href}
                    className="block py-2 text-foreground/80 hover:text-accent transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              ))}
              <div className="pt-4 border-t border-border/50 space-y-3">
                {user ? (
                  <>
                    <Link to={getDashboardPath()} onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        {t.nav.dashboard || 'لوحة التحكم'}
                      </Button>
                    </Link>
                    <Button 
                      variant="destructive" 
                      className="w-full gap-2"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-4 h-4" />
                      {t.nav.logout || 'تسجيل الخروج'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">
                        {t.nav.login}
                      </Button>
                    </Link>
                    <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button className="w-full btn-gold">
                        {t.nav.signup}
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
