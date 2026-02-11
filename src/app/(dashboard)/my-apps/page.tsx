"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, ExternalLink, Loader2, Users, CheckCircle2, Settings } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface App {
  id: string;
  name: string;
  status: string;
  stats: {
    participants: number;
    dailyParticipants: number;
  };
}

export default function MyAppsPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApps = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "apps"),
        where("developerId", "==", user.uid),
        where("status", "!=", "deleted")
      );
      const querySnapshot = await getDocs(q);
      const fetchedApps = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          stats: {
            participants: data.stats?.participants || 0,
            dailyParticipants: data.stats?.dailyParticipants || 0,
          },
        };
      }) as App[];
      setApps(fetchedApps);
    } catch (error) {
      console.error("Error fetching apps:", error);
      toast.error("앱 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchApps();
    }
  }, [user, fetchApps]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">내 앱 관리</h1>
          <p className="text-muted-foreground text-lg">
            등록한 앱들을 관리하고 테스트 진행 상황을 확인하세요.
          </p>
        </div>
        <Button asChild>
          <Link href="/my-apps/register">
            <Plus className="mr-2 h-4 w-4" />
            앱 등록하기
          </Link>
        </Button>
      </div>

      <Card className="bg-blue-50/50 border-blue-100 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="bg-blue-600 p-3 rounded-2xl shrink-0">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-lg font-black text-blue-900">성공적인 테스터 모집을 위한 팁</h3>
              <p className="text-sm text-blue-800/70 leading-relaxed">
                Google Groups를 활용하면 20명의 테스터를 가장 빠르고 효율적으로 관리할 수 있습니다.
                그룹 가입을 <strong>&apos;웹 상의 모든 사용자&apos;</strong>에게 허용하고,
                그룹 이메일을 Play Console의 테스터 목록에 추가하는 것을 잊지 마세요!
              </p>
            </div>
            <Button variant="outline" size="sm" className="bg-white border-blue-200 text-blue-700 font-bold hover:bg-blue-50" asChild>
              <Link href="/workflow-guide">
                워크플로우 가이드 보기
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {apps.length === 0 ? (
        <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 bg-slate-50/50">
          <p className="text-slate-500 mb-4">등록된 앱이 없습니다.</p>
          <Button asChild variant="outline">
            <Link href="/my-apps/register">첫 번째 앱 등록하기</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl font-bold truncate">{app.name}</CardTitle>
                  <Badge variant={app.status === "recruiting" ? "default" : "secondary"}>
                    {app.status === "recruiting" ? "모집 중" : app.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Users className="h-4 w-4" />
                  <span>총 {app.stats?.participants || 0}명의 테스터</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600 font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>오늘 {app.stats?.dailyParticipants || 0}명 참여 중</span>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50/50 border-t flex gap-2 p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 font-bold"
                  asChild
                >
                  <Link href={`/my-apps/${app.id}/manage`}>
                    <Settings className="mr-2 h-4 w-4" />
                    관리하기
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-10 font-bold text-slate-600"
                  asChild
                >
                  <Link href={`/apps/${app.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    상세보기
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
