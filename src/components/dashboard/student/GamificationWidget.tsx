import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Star, Zap, Medal, Crown, Target, Flame } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const levelIcons = [Target, Zap, Star, Medal, Crown];
const levelColors = ['text-zinc-400', 'text-emerald-500', 'text-blue-500', 'text-purple-500', 'text-amber-500'];

const getLevelInfo = (level: number) => {
  const idx = Math.min(level - 1, levelIcons.length - 1);
  return { Icon: levelIcons[idx], color: levelColors[idx] };
};

export const GamificationWidget = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const { data: profile } = useQuery({
    queryKey: ['gamification-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gamification_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userBadges = [] } = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('*, badges(*)')
        .eq('user_id', user!.id)
        .order('earned_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: allBadges = [] } = useQuery({
    queryKey: ['all-badges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true)
        .order('requirement_value');
      if (error) throw error;
      return data;
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gamification_profiles')
        .select('user_id, total_points, current_level')
        .order('total_points', { ascending: false })
        .limit(10);
      if (error) throw error;
      // Fetch profiles for names
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, full_name_ar, avatar_url')
        .in('id', userIds);
      return data.map(d => ({
        ...d,
        profile: profiles?.find(p => p.id === d.user_id),
      }));
    },
  });

  const totalPoints = profile?.total_points || 0;
  const currentLevel = profile?.current_level || 1;
  const pointsInLevel = totalPoints % 100;
  const nextLevelPoints = 100;
  const { Icon: LevelIcon, color: levelColor } = getLevelInfo(currentLevel);
  const earnedBadgeIds = new Set(userBadges.map((ub: any) => ub.badge_id));

  return (
    <div className="space-y-6">
      {/* Points & Level Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden relative">
        <div className="absolute top-0 end-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            {isRTL ? 'إنجازاتي' : 'My Achievements'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ${levelColor}`}>
                <LevelIcon className="w-8 h-8" />
              </div>
              <span className="text-sm font-bold">{isRTL ? `المستوى ${currentLevel}` : `Level ${currentLevel}`}</span>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-2xl">{totalPoints}</span>
                <span className="text-muted-foreground">{isRTL ? 'نقطة' : 'points'}</span>
              </div>
              <Progress value={(pointsInLevel / nextLevelPoints) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? `${nextLevelPoints - pointsInLevel} نقطة للمستوى التالي`
                  : `${nextLevelPoints - pointsInLevel} points to next level`}
              </p>
            </div>
          </div>
          {profile?.streak_days ? (
            <div className="mt-4 flex items-center gap-2 text-orange-500">
              <Flame className="w-4 h-4" />
              <span className="text-sm font-medium">
                {isRTL ? `${profile.streak_days} يوم متتالي` : `${profile.streak_days} day streak`}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="badges" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="badges">{isRTL ? 'الأوسمة' : 'Badges'}</TabsTrigger>
          <TabsTrigger value="leaderboard">{isRTL ? 'لوحة الشرف' : 'Leaderboard'}</TabsTrigger>
        </TabsList>

        <TabsContent value="badges">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {allBadges.map((badge: any) => {
                  const earned = earnedBadgeIds.has(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                        earned
                          ? 'bg-primary/5 border-primary/20 shadow-sm'
                          : 'bg-muted/30 border-transparent opacity-50 grayscale'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        earned ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <Medal className={`w-6 h-6 ${earned ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <span className="text-sm font-medium text-center">
                        {isRTL ? badge.name_ar : badge.name}
                      </span>
                      <span className="text-xs text-muted-foreground text-center">
                        {isRTL ? badge.description_ar : badge.description}
                      </span>
                      {earned && (
                        <Badge variant="secondary" className="text-xs">
                          {isRTL ? '✓ مكتسب' : '✓ Earned'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {leaderboard.map((entry: any, index: number) => {
                    const isMe = entry.user_id === user?.id;
                    const rankIcons = ['🥇', '🥈', '🥉'];
                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                          isMe ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                        }`}
                      >
                        <span className="text-lg font-bold w-8 text-center">
                          {index < 3 ? rankIcons[index] : index + 1}
                        </span>
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {entry.profile?.avatar_url ? (
                            <img src={entry.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-muted-foreground">
                              {(entry.profile?.full_name || '?')[0]}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {isRTL
                              ? entry.profile?.full_name_ar || entry.profile?.full_name || '—'
                              : entry.profile?.full_name || '—'}
                            {isMe && <Badge variant="outline" className="ms-2 text-xs">{isRTL ? 'أنت' : 'You'}</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isRTL ? `المستوى ${entry.current_level}` : `Level ${entry.current_level}`}
                          </p>
                        </div>
                        <span className="font-bold text-primary">{entry.total_points}</span>
                      </div>
                    );
                  })}
                  {leaderboard.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      {isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
