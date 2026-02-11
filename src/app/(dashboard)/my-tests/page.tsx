"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Participation {
  id: string;
  appId: string;
  appName: string;
  targetDays: number;
  consecutiveDays: number;
  dailyChecks: Record<string, boolean>;
  status: string;
  startDate?: { toDate: () => Date };
}

export default function MyTestsPage() {
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchParticipations();
    }
  }, [user]);

  const fetchParticipations = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "participations"),
        where("testerId", "==", user.uid),
        where("status", "==", "active")
      );
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Participation[];
      setParticipations(fetched);
    } catch (error) {
      console.error("Error fetching participations:", error);
      toast.error("테스트 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (participation: Participation) => {
    const today = format(new Date(), "yyyy-MM-dd");

    if (participation.dailyChecks[today]) {
      toast.info("오늘 이미 출석 체크를 완료했습니다!");
      return;
    }

    setCheckingInId(participation.id);
    try {
      const partRef = doc(db, "participations", participation.id);
      await updateDoc(partRef, {
        [`dailyChecks.${today}`]: true,
        consecutiveDays: increment(1),
        updatedAt: serverTimestamp(),
      });

      toast.success(`${participation.appName} 출석 체크 성공!`);
      fetchParticipations();
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("출석 체크에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setCheckingInId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");

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
            const progress = (p.consecutiveDays / p.targetDays) * 100;
            const isCheckedInToday = p.dailyChecks[todayStr];

            return (
              <Card key={p.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl line-clamp-1">{p.appName}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">진행률</span>
                      <span className="font-medium">
                        {p.consecutiveDays} / {p.targetDays} 일
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>시작일: {p.startDate ? format(p.startDate.toDate(), "yyyy년 M월 d일") : "..."}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleCheckIn(p)}
                    disabled={isCheckedInToday || checkingInId === p.id}
                    variant={isCheckedInToday ? "secondary" : "default"}
                  >
                    {checkingInId === p.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isCheckedInToday ? (
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                    ) : null}
                    {isCheckedInToday ? "오늘 출석 완료" : "오늘의 출석 체크"}
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
