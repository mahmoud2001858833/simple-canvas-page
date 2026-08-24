import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, Menu, Globe, Search, Check, User, Settings, LogOut } from 'lucide-react';
import { ProfileDialog } from '@/components/dashboard/ProfileDialog';

import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useRealNotifications } from '@/hooks/useRealNotifications';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { openDirectSupportChat } from '@/components/support/DirectSupportChat';

interface HeaderProps {
  userName: string;
  onMenuClick: () => void;
}

export const DashboardHeader = ({ userName, onMenuClick }: HeaderProps) => {
  const { language, setLanguage, dir } = useLanguage();
  const { role } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealNotifications();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const userRole = role;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNotificationClick = async (notification: any) => {
    await markAsRead(notification.id);
    if (notification.link) {
      let correctedLink = notification.link;
      
      if (correctedLink.startsWith('/course/') && !correctedLink.startsWith('/courses/')) {
        correctedLink = correctedLink.replace('/course/', '/courses/');
      }
      
      if (correctedLink.includes('support') || correctedLink.includes('chat')) {
        if (userRole === 'admin') {
          navigate('/admin?tab=support');
        } else {
          openDirectSupportChat();
        }
        return;
      }
      
      if (correctedLink.includes('request') || correctedLink.includes('message')) {
        if (userRole === 'admin') {
          navigate('/admin?tab=requests');
        } else if (userRole === 'student') {
          navigate('/dashboard?tab=my-requests');
        } else if (userRole === 'instructor') {
          navigate('/instructor?tab=messages');
        }
        return;
      }
      
      navigate(correctedLink);
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-auto h-16 z-30 transition-all duration-300 border-b border-border/40"
      style={{
        background: 'linear-gradient(135deg, hsl(215 55% 15% / 0.85) 0%, hsl(200 50% 18% / 0.8) 50%, hsl(155 40% 16% / 0.85) 100%)',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
      }}
    >
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        {/* Mobile menu & Search */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="md:hidden hover:bg-white/10 text-white transition-colors">
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-xl px-4 py-2.5 w-72 transition-all duration-200 border border-white/10 focus-within:border-primary/40 focus-within:bg-white/15">
            <Search className="w-4 h-4 text-white/60" />
            <Input
              type="text"
              placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
              className="border-0 bg-transparent h-auto p-0 focus-visible:ring-0 text-sm text-white placeholder:text-white/40"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="hover:bg-white/10 text-white/80 transition-all duration-200 rounded-xl"
          >
            <Globe className="w-5 h-5" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative hover:bg-white/10 text-white/80 transition-all duration-200 rounded-xl">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent rounded-full text-xs text-accent-foreground flex items-center justify-center animate-pulse shadow-gold font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={dir === 'rtl' ? 'start' : 'end'} className="w-80 rounded-xl shadow-xl border-border/50">
              <div className="p-4 border-b flex items-center justify-between">
                <h4 className="font-semibold">{isRTL ? 'الإشعارات' : 'Notifications'}</h4>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs hover:bg-primary/10 rounded-lg">
                    <Check className="w-3 h-3 me-1" />
                    {isRTL ? 'قراءة الكل' : 'Mark all read'}
                  </Button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {isRTL ? 'لا توجد إشعارات' : 'No notifications'}
                </div>
              ) : (
                notifications.slice(0, 5).map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id} 
                    className={`p-4 cursor-pointer rounded-lg mx-1 my-0.5 ${!notification.is_read ? 'bg-primary/5' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {isRTL ? notification.title_ar || notification.title : notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {isRTL ? notification.message_ar || notification.message : notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notification.created_at), 'PPp', { locale: isRTL ? ar : enUS })}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 rounded-xl hover:bg-white/10 transition-colors py-1">
                <Avatar className="w-9 h-9 ring-2 ring-accent/40 ring-offset-1 ring-offset-transparent">
                  <AvatarImage src={profile?.avatar_url || ''} alt={userName} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-sm font-bold">
                    {getInitials(userName || 'U')}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium text-white">{userName}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={dir === 'rtl' ? 'start' : 'end'} className="w-56 rounded-xl">
              <div className="px-3 py-2">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileOpen(true)} className="cursor-pointer gap-2">
                <User className="w-4 h-4" />
                {isRTL ? 'الملف الشخصي' : 'My Profile'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={goToSettings} className="cursor-pointer gap-2">
                <Settings className="w-4 h-4" />
                {isRTL ? 'الإعدادات' : 'Settings'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4" />
                {isRTL ? 'تسجيل الخروج' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} onOpenSettings={goToSettings} />


        </div>
      </div>
    </header>
  );
};
