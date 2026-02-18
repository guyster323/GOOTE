"use client";

import { useEffect, Suspense, useRef, useState } from "react";
import { loginWithGoogle } from "@/lib/auth";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppWindow, Sparkles, ShieldCheck, Loader2, ListChecks, HelpCircle } from "lucide-react";
import { collection, query, getDocs, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function HomeContent() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [testApps, setTestApps] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [releaseTooltipOpen, setReleaseTooltipOpen] = useState(false);
  const releaseTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      router.push(redirect || "/dashboard");
    }
  }, [user, isLoading, router, redirect]);

  useEffect(() => {
    const fetchTestApps = async () => {
      try {
        const q = query(
          collection(db, "apps"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const apps = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTestApps(apps);
      } catch (error) {
        console.error("Error fetching test apps:", error);
      } finally {
        setLoadingApps(false);
      }
    };

    fetchTestApps();
  }, []);


  useEffect(() => {
    return () => {
      if (releaseTooltipTimerRef.current) {
        clearTimeout(releaseTooltipTimerRef.current);
      }
    };
  }, []);

  const handleReleaseNoteClick = () => {
    setReleaseTooltipOpen(true);

    if (releaseTooltipTimerRef.current) {
      clearTimeout(releaseTooltipTimerRef.current);
    }

    releaseTooltipTimerRef.current = setTimeout(() => {
      setReleaseTooltipOpen(false);
      releaseTooltipTimerRef.current = null;
    }, 5000);
  };
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20 animate-pulse border border-primary/30 flex items-center justify-center">
            <AppWindow className="h-6 w-6 text-primary" />
          </div>
          <p className="text-slate-400 font-medium animate-pulse">Loading experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen relative overflow-hidden bg-slate-950 items-center justify-center px-4">
      {/* Abstract Background Effects */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-2xl mb-4">
            <AppWindow className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white inline-flex items-start justify-center gap-2">
            <span>GOOTE</span>
            <span className="text-xs text-slate-500 align-top mt-1 font-bold">v0.7</span>
            <TooltipProvider delayDuration={0}>
              <Tooltip open={releaseTooltipOpen} onOpenChange={setReleaseTooltipOpen}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="v0.7 업데이트 내역 보기"
                    className="mt-1 text-slate-500 hover:text-slate-300 transition-colors"
                    onClick={handleReleaseNoteClick}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" className="max-w-xs bg-slate-900 text-slate-100 border border-slate-700 p-3">
                  <p className="font-bold mb-1">v0.7 업데이트</p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                    <li>앱 상세의 Android/Web 참여 링크 클릭이 오늘 참여 완료 카운트로 반영</li>
                    <li>참여 중인 테스트의 오늘의 출석 체크가 Android 참여 링크를 열고 동일 카운트 반영</li>
                    <li>일일 메일 스케줄러 안정성 개선(allSettled, 누락 이메일 가드, KST 날짜 기준 통일)</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h1>
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span>Premium App Testing Community</span>
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          <CardHeader className="pt-8 pb-4 text-center">
            <CardTitle className="text-2xl font-bold text-white">Welcome back</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <Button
              onClick={handleLogin}
              variant="outline"
              className="w-full h-12 text-md font-bold gap-3 border-slate-700 bg-white hover:bg-slate-50 text-slate-900 transition-all active:scale-95"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">Secure access</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span>Verified and Secured by Google Auth</span>
            </div>
          </CardContent>
        </Card>

        {/* Test Status Section */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4 justify-center text-slate-400">
            <ListChecks className="h-4 w-4" />
            <span className="text-sm font-bold uppercase tracking-wider">최근 등록된 테스트</span>
          </div>

          <Card className="border-slate-800 bg-slate-900/30 backdrop-blur-sm">
            <CardContent className="p-0">
              {loadingApps ? (
                <div className="p-6 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500 mx-auto" />
                </div>
              ) : testApps.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  테스트 진행 내용 없음
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {testApps.map((app) => (
                    <div key={app.id} className="p-4 flex flex-col gap-1 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300 text-sm">{app.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                          {app.category || "기타"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {app.description || "설명 없음"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

