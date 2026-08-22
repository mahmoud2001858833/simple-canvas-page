import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Mail, Phone, MapPin } from 'lucide-react';
import logo from '@/assets/logo.png';
import { openChatWidget } from '@/components/ai-assistant/ChatWidget';
import { useSocialLinks } from '@/hooks/useSocialLinks';
import { getPlatform } from '@/lib/socialPlatforms';


const Footer = () => {
  const { language, t } = useLanguage();

  const quickLinks = [
    { label: t.nav.home, href: '/' },
    { label: t.nav.courses, href: '/courses' },
    { label: t.nav.universities, href: '/universities' },
    { label: language === 'ar' ? 'من نحن' : 'About Us', href: '/about' },
  ];

  const supportLinks = [
    { label: language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ', href: '#faq', isChat: false },
    { label: language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy', href: '/privacy', isChat: false },
    { label: language === 'ar' ? 'شروط الاستخدام' : 'Terms of Use', href: '/terms', isChat: false },
    { label: language === 'ar' ? 'تواصل معنا' : 'Contact Us', href: '#', isChat: true },
  ];

  const { links: socialLinks } = useSocialLinks();


  return (
    <footer className="bg-gradient-to-br from-emerald-950 via-teal-900 to-green-950 text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <img src={logo} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-white/10 p-1" />
              <span className="text-2xl font-bold text-gradient-gold">{t.hero.title}</span>
            </Link>
            <p className="text-white/60 mb-6 leading-relaxed">
              {language === 'ar'
                ? 'منصة تعليمية رقمية متخصصة في تقديم الدورات الأكاديمية للطلاب الأكاديميين في المملكة العربية السعودية.'
                : 'A digital educational platform specialized in providing academic courses for university students in Saudi Arabia.'}
            </p>
            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {socialLinks.map((social) => {
                  const platform = getPlatform(social.id);
                  if (!platform) return null;
                  const Icon = platform.icon;
                  return (
                    <a
                      key={social.id}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={language === 'ar' ? platform.labelAr : platform.label}
                      title={language === 'ar' ? platform.labelAr : platform.label}
                      className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            )}


          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold mb-6">
              {language === 'ar' ? 'روابط سريعة' : 'Quick Links'}
            </h4>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                    className="text-white/60 hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-bold mb-6">
              {language === 'ar' ? 'الدعم' : 'Support'}
            </h4>
            <ul className="space-y-3">
              {supportLinks.map((link, index) => (
                <li key={index}>
                  {link.isChat ? (
                    <button
                      onClick={() => openChatWidget()}
                      className="text-white/60 hover:text-accent transition-colors"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-white/60 hover:text-accent transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-bold mb-6">
              {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
            </h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-white/60">
                <Mail className="w-5 h-5 text-accent" />
                <span>Josoorcom@outlook.com</span>
              </li>
              <li className="flex items-center gap-3 text-white/60">
                <Phone className="w-5 h-5 text-accent" />
                <span dir="ltr">+966 568882237</span>
              </li>
              <li className="flex items-center gap-3 text-white/60">
                <MapPin className="w-5 h-5 text-accent" />
                <span>{language === 'ar' ? 'الرياض، المملكة العربية السعودية' : 'Riyadh, Saudi Arabia'}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/50 text-sm text-center">
              © 2024 {t.hero.title}. {t.footer.copyright}
            </p>
            <div className="flex items-center gap-4">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/124px-PayPal.svg.png" 
                alt="PayPal" 
                className="h-6 opacity-50 hover:opacity-100 transition-opacity"
              />
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/200px-Visa_Inc._logo.svg.png" 
                alt="Visa" 
                className="h-6 opacity-50 hover:opacity-100 transition-opacity"
              />
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/200px-Mastercard-logo.svg.png" 
                alt="Mastercard" 
                className="h-6 opacity-50 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
