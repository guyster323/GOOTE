"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  documentId,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Calendar, Handshake } from "lucide-react";
import { format } from "date-fns";
import { createDailyTrackUrl } from "@/lib/daily-track";
import {
  getParticipationStartDate,
  isAppTestCompleted,
  isParticipationExpired,
} from "@/lib/test-period";

interface Participation {
  id: string;
  appId: string;
  appName: string;
  targetDays: number;
  consecutiveDays: number;
  dailyChecks: Record<string, boolean>;
  status: string;
  startDate?: unknown;
  createdAt?: unknown;
  endDate?: unknown;
}

interface AppInfo {
  id: string;
  name?: string;
  developerId?: string;
  createdAt?: unknown;
  testDuration?: number;
  status?: string;
}

interface CrossStatus {
  hasMyApps: boolean;
  isDeveloperTestingMine: boolean;
}

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

export default function MyTestsPage() {
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [appInfoById, setAppInfoById] = useState<Record<string, AppInfo>>({});
  const [crossStatusByAppId, setCrossStatusByAppId] = useState<Record<string, CrossStatus>>({});
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "participations"), where("testerId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const fetched = snapshot.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                appName: data.appName || "이름 없는 앱",
                targetDays: data.targetDays || 14,
                consecutiveDays: data.consecutiveDays || 0,
                dailyChecks: data.dailyChecks || {},
              };
            })
            .filter((p: any) => ["active", "pending", "completed"].includes(p.status)) as Participation[];

          const now = new Date();
          const statusFiltered = fetched.filter((p) => p.status !== "completed");
          const periodFiltered = statusFiltered.filter((p) => !isParticipationExpired(p, now));

          const appIds = Array.from(new Set(periodFiltered.map((p) => p.appId).filter(Boolean)));
          const appInfoMap: Record<string, AppInfo> = {};

          for (const ids of chunk(appIds, 10)) {
            const appsSnapshot = await getDocs(query(collection(db, "apps"), where(documentId(), "in", ids)));
            appsSnapshot.docs.forEach((appDoc) => {
              appInfoMap[appDoc.id] = { id: appDoc.id, ...appDoc.data() } as AppInfo;
            });
          }

          const notCompletedApps = periodFiltered.filter((p) => {
            const appInfo = appInfoMap[p.appId];
            return appInfo ? !isAppTestCompleted(appInfo, now) : true;
          });

          setParticipations(notCompletedApps);
          setAppInfoById(appInfoMap);

          const myAppsSnapshot = await getDocs(
            query(
              collection(db, "apps"),
              where("developerId", "==", user.uid),
              where("status", "!=", "deleted")
            )
          );

          const myApps = myAppsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          const hasMyApps = myApps.length > 0;
          const myAppIdSet = new Set(myApps.map((a) => a.id));

          const developerIds = Array.from(
            new Set(
              notCompletedApps
                .map((p) => appInfoMap[p.appId]?.developerId)
                .filter((id): id is string => Boolean(id))
            )
          );

          const developersTestingMine = new Set<string>();

          if (hasMyApps && developerIds.length > 0) {
            for (const testerIds of chunk(developerIds, 10)) {
              const crossSnap = await getDocs(
                query(
                  collection(db, "participations"),
                  where("testerId", "in", testerIds),
                  where("status", "in", ["active", "completed"])
                )
              );

              crossSnap.docs.forEach((crossDoc) => {
                const cross = crossDoc.data() as { testerId?: string; appId?: string };
                if (cross.testerId && cross.appId && myAppIdSet.has(cross.appId)) {
                  developersTestingMine.add(cross.testerId);
                }
              });
            }
          }

          const crossMap: Record<string, CrossStatus> = {};
          notCompletedApps.forEach((p) => {
            const developerId = appInfoMap[p.appId]?.developerId;
            crossMap[p.appId] = {
              hasMyApps,
              isDeveloperTestingMine: hasMyApps && Boolean(developerId && developersTestingMine.has(developerId)),
            };
          });

          setCrossStatusByAppId(crossMap);
        } catch (error) {
          console.error("Error composing my tests view:", error);
          toast.error("테스트 목록을 불러오는데 실패했습니다.");
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching participations:", error);
        toast.error("테스트 목록을 불러오는데 실패했습니다.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleCheckIn = async (participation: Participation) => {
    const today = format(new Date(), "yyyy-MM-dd");

    if (participation.dailyChecks[today]) {
      toast.info("오늘 이미 출석 체크를 완료했습니다!");
      return;
    }

    setCheckingInId(participation.id);
    try {
      const trackUrl = await createDailyTrackUrl(participation.id, "android");
      const opened = window.open(trackUrl, "_blank", "noopener,noreferrer");

      if (!opened) {
        window.location.href = trackUrl;
      }

      toast.success(`${participation.appName} Android 링크를 열었습니다. 실행 시 오늘 참여가 반영됩니다.`);
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("출석 체크에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setCheckingInId(null);
    }
  };

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const safeDateFormat = (date: Date | null) => {
    if (!date) return "미정";
    if (Number.isNaN(date.getTime())) return "날짜 오류";
    return format(date, "yyyy년 M월 d일");
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">내 테스트</h1>
        <p className="text-muted-foreground text-lg">
          참여 중인 앱의 테스트 진행 상황을 확인하고 매일 출석 체크를 완료하세요.
        </p>
      </div>

      {participations.length === 0 ? (
        <div className="flex h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed text-center p-8">
          <p className="text-muted-foreground">현재 참여 중인 테스트가 없습니다.</p>
          <Button asChild variant="link" className="mt-2">
            <a href="/explore">테스트할 앱 탐색하기</a>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {participations.map((p) => {
            const progress = ((p.consecutiveDays || 0) / (p.targetDays || 14)) * 100;
            const isCheckedInToday = p.dailyChecks ? p.dailyChecks[todayStr] : false;
            const startDate = getParticipationStartDate(p);
            const cross = crossStatusByAppId[p.appId];
            const developer = appInfoById[p.appId]?.developerId;

            return (
              <Card
                key={p.id}
                className="flex flex-col cursor-pointer transition-shadow hover:shadow-md"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/apps/${p.appId}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/apps/${p.appId}`);
                  }
                }}
              >
                <CardHeader>
                  <CardTitle className="text-xl line-clamp-1">{p.appName}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">진행률</span>
                      <span className="font-medium">
                        {p.consecutiveDays || 0} / {p.targetDays || 14} 일
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>시작일: {safeDateFormat(startDate)}</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {!cross?.hasMyApps ? (
                      <p className="text-sm font-semibold text-slate-700">테스트 참여에 감사합니다.</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Handshake className="h-4 w-4 text-primary" />
                        {cross.isDeveloperTestingMine ? (
                          <Badge className="bg-emerald-600">해당 개발자가 내 앱 테스트 중</Badge>
                        ) : (
                          <Badge variant="secondary">해당 개발자가 내 앱 테스트 전</Badge>
                        )}
                      </div>
                    )}
                    {!developer && (
                      <p className="mt-1 text-[11px] text-slate-500">개발자 정보를 확인할 수 없습니다.</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCheckIn(p);
                    }}
                    disabled={isCheckedInToday || checkingInId === p.id}
                    variant={isCheckedInToday ? "secondary" : "default"}
                  >
                    {checkingInId === p.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      !isCheckedInToday && <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {isCheckedInToday ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> 오늘 출석 완료
                      </>
                    ) : (
                      "오늘의 출석 체크"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

