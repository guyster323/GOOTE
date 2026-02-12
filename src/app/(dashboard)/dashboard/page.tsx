"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Layout, Heart, Sparkles, ArrowUpRight, MessageSquare, User, Clock, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({
    activeTests: 0,
    registeredApps: 0,
    totalLikes: 0,
    dailyParticipants: 0,
  });
  const [recentComments, setRecentComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Real-time subscription for participations
    const testsQuery = query(
      collection(db, "participations"),
      where("testerId", "==", user.uid)
    );

    const unsubscribeTests = onSnapshot(testsQuery, (snapshot) => {
      // Filter active or completed on client side for more robust counting
      const activeCount = snapshot.docs.filter(d =>
        ["active", "pending", "completed"].includes(d.data().status)
      ).length;
      setStats(prev => ({ ...prev, activeTests: activeCount }));
    });

    // Real-time subscription for registered apps
    const appsQuery = query(
      collection(db, "apps"),
      where("developerId", "==", user.uid)
    );

    const unsubscribeApps = onSnapshot(appsQuery, async (snapshot) => {
      const apps = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(app => app.status !== "deleted");
      const totalLikes = apps.reduce((acc, app) => acc + (app.stats?.likes || 0), 0);
      const dailyParticipants = apps.reduce((acc, app) => acc + (app.stats?.dailyParticipants || 0), 0);

      setStats(prev => ({
        ...prev,
        registeredApps: apps.length,
        totalLikes: totalLikes,
        dailyParticipants: dailyParticipants,
      }));

      // Fetch recent comments for user's apps - WITHOUT REQUIRING INDEX
      if (apps.length > 0) {
        try {
          const appIds = apps.map(app => app.id);
          // Firestore "in" queries support max 10 items
          const q = query(
            collection(db, "comments"),
            where("appId", "in", appIds.slice(0, 10))
          );
          const commentsSnap = await getDocs(q);
          const comments = commentsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            appName: apps.find(a => a.id === doc.data().appId)?.name
          }));

          // Sort client-side to avoid index requirement
          const sortedComments = comments.sort((a: any, b: any) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          }).slice(0, 5);

          setRecentComments(sortedComments);
        } catch (error) {
          console.error("Error fetching comments:", error);
          setRecentComments([]);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeTests();
      unsubscribeApps();
    };
  }, [user]);

  // Remove the old fetchData function call from useEffect and the function itself
  // if not used elsewhere. In this case, it's replaced by subscriptions.

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-wider uppercase">
          <Sparkles className="h-4 w-4" />
          <span>개요</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">
          다시 오신 것을 환영합니다, <span className="text-primary">{profile?.nickname || "친구"}</span>님!
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          오늘 당신의 앱과 테스트 현황입니다.
        </p>
      </div>

      <Separator className="bg-slate-200/60" />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Participation Card */}
        <Card className="relative overflow-hidden border-none shadow-lg shadow-blue-500/5 bg-white group hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Zap className="h-16 w-16 text-blue-600" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" /> 진행 중인 테스트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-slate-900">{stats.activeTests}</span>
              <span className="text-sm font-medium text-slate-400">개</span>
            </div>
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              현재 테스트 중 <ArrowUpRight className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>

        {/* Apps Card */}
        <Card className="relative overflow-hidden border-none shadow-lg shadow-indigo-500/5 bg-white group hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Layout className="h-16 w-16 text-indigo-600" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Layout className="h-4 w-4 text-indigo-500" /> 등록된 앱
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-slate-900">{stats.registeredApps}</span>
              <span className="text-sm font-medium text-slate-400">개</span>
            </div>
            <p className="text-xs text-muted-foreground mt-4">당신의 개발자 포트폴리오</p>
          </CardContent>
        </Card>

        {/* Likes Card */}
        <Card className="relative overflow-hidden border-none shadow-lg shadow-rose-500/5 bg-white group hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Heart className="h-16 w-16 text-rose-600" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" /> 오늘 참여자 수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-slate-900">{stats.dailyParticipants}</span>
              <span className="text-sm font-medium text-slate-400">명</span>
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-rose-500 font-medium">실시간 참여 현황</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 mt-10">
        {/* Recent Comments Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            최근 피드백
          </h2>
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              {recentComments.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  아직 도착한 피드백이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentComments.map((comment) => (
                    <div key={comment.id} className="p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="font-bold text-slate-900">{comment.userName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: ko }) : "방금 전"}
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm line-clamp-2 mt-2 px-1">
                        {comment.content}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <Badge variant="secondary" className="text-[10px] font-medium bg-slate-100 text-slate-500 border-none">
                          {comment.appName}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {recentComments.length > 0 && (
              <CardFooter className="border-t bg-slate-50/50 justify-center p-3">
                <Button variant="ghost" size="sm" className="text-xs text-slate-500 font-bold" asChild>
                  <Link href="/my-apps">모든 앱 피드백 보기</Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            커뮤니티 소식
          </h2>
          <Card className="border-none shadow-sm bg-indigo-900 text-white overflow-hidden h-fit">
            <div className="p-8 md:p-12 relative">
              <div className="relative z-10 space-y-4 max-w-xl">
                <h2 className="text-3xl font-bold italic tracking-tight">&quot;커뮤니티가 전부입니다.&quot;</h2>
                <p className="text-indigo-100 text-lg">
                  카카오톡 오픈채팅에 참여하여 더 많은 개발자들과 소통하고 앱에 대한 빠른 피드백을 받으세요.
                </p>
                <a
                  href="https://open.kakao.com/o/ghJ9350f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-white text-indigo-900 px-6 py-2 rounded-full font-bold hover:bg-indigo-50 transition-colors mt-4"
                >
                  오픈채팅 참여하기
                </a>
              </div>
              <div className="absolute right-0 bottom-0 p-8 opacity-20 hidden md:block">
                <Sparkles className="h-48 w-48" />
              </div>
            </div>
          </Card>

          <Card className="border-none shadow-lg shadow-primary/5 bg-white overflow-hidden group">
            <CardHeader className="pb-2 border-b border-slate-50 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-primary flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4" /> 워크플로우 팁
                </span>
                <Link href="/workflow-guide" className="text-[10px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
                  전체 가이드 <ChevronRight className="h-3 w-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-900 leading-none">그룹 가입 권한 해제</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">구글 그룹스 설정을 &apos;웹 상의 모든 사용자&apos;로 변경하여 참여 허들을 낮추세요.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-900 leading-none">데일리 메일 실행하기</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">오전 9시 30분 발송되는 메일의 실행 버튼을 눌러 일일 참여 인증을 완료하세요.</p>
                  </div>
                </div>
              </div>
              <Button size="sm" className="w-full text-[11px] font-bold h-9 bg-slate-900 hover:bg-slate-800 rounded-xl" asChild>
                <Link href="/workflow-guide">전체 프로세스 확인하기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
