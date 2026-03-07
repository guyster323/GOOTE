"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Users, Calendar, Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { isAppTestCompleted, isParticipationExpired } from "@/lib/test-period";

interface App {
  id: string;
  name: string;
  category: string;
  developerId?: string;
  developerNickname: string;
  testDuration: number;
  participationLink: string;
  createdAt?: unknown;
  status?: string;
  stats: {
    participants: number;
  };
}

interface Participation {
  appId?: string;
  status?: string;
  startDate?: unknown;
  createdAt?: unknown;
  endDate?: unknown;
  targetDays?: number;
}

type JoinedBadgeStatus = "active" | "pending" | "completed";

interface RankingUser {
  id: string;
  email?: string;
  nickname?: string;
  stats?: {
    testsJoined?: number;
    testsCompleted?: number;
  };
}

const UNRANKED_SORT_VALUE = Number.MAX_SAFE_INTEGER;

const categories = [
  { id: "all", label: "전체" },
  { id: "game", label: "게임" },
  { id: "utility", label: "유틸리티" },
  { id: "productivity", label: "생산성" },
  { id: "other", label: "기타" },
  { id: "test-completed", label: "테스트 완료" },
] as const;

const getDisplayName = (user: RankingUser) =>
  user.nickname?.trim() || user.email?.split("@")[0] || "익명 사용자";

const getCreatedAtMillis = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return 0;
};

const getPromotionBadge = (rank?: number) => {
  if (!rank) return null;
  if (rank <= 10) {
    return {
      label: "열혈 맞테스터",
      className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
    };
  }

  if (rank <= 20) {
    return {
      label: "맞테스터",
      className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    };
  }

  return null;
};

export default function ExplorePage() {
  const [apps, setApps] = useState<App[]>([]);
  const [joinedAppStatusById, setJoinedAppStatusById] = useState<Record<string, JoinedBadgeStatus>>({});
  const [developerRankById, setDeveloperRankById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const fetchApps = async () => {
      setLoading(true);

      try {
        const appsQuery = query(collection(db, "apps"), where("status", "in", ["recruiting", "test-completed"]));
        const participationsQuery = user
          ? query(collection(db, "participations"), where("testerId", "==", user.uid))
          : null;
        const usersQuery = collection(db, "users");

        const [appsSnapshot, participationsSnapshot, usersSnapshot] = await Promise.all([
          getDocs(appsQuery),
          participationsQuery ? getDocs(participationsQuery) : Promise.resolve(null),
          getDocs(usersQuery),
        ]);

        if (cancelled) return;

        const fetchedApps = appsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as App[];

        const joinedStatuses: Record<string, JoinedBadgeStatus> = {};
        participationsSnapshot?.docs.forEach((doc) => {
          const participation = doc.data() as Participation;
          const status = participation.status || "";
          if (!["active", "pending", "completed"].includes(status)) return;
          if (!participation.appId) return;
          if (status === "completed") {
            joinedStatuses[participation.appId] = "completed";
            return;
          }
          if (isParticipationExpired(participation)) return;
          joinedStatuses[participation.appId] = status === "pending" ? "pending" : "active";
        });

        const rankedUsers = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RankingUser[];

        const nextDeveloperRankById = [...rankedUsers]
          .sort((a, b) => {
            const joinedDiff = (b.stats?.testsJoined || 0) - (a.stats?.testsJoined || 0);
            if (joinedDiff !== 0) return joinedDiff;

            const completedDiff = (b.stats?.testsCompleted || 0) - (a.stats?.testsCompleted || 0);
            if (completedDiff !== 0) return completedDiff;

            return getDisplayName(a).localeCompare(getDisplayName(b), "ko");
          })
          .reduce<Record<string, number>>((acc, member, index) => {
            acc[member.id] = index + 1;
            return acc;
          }, {});

        setApps(fetchedApps);
        setJoinedAppStatusById(joinedStatuses);
        setDeveloperRankById(nextDeveloperRankById);
      } catch (error) {
        console.error("Error fetching apps:", error);
        toast.error("앱을 불러오는데 실패했습니다.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchApps();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredApps = useMemo(() => {
    return apps
      .filter((app) => {
        const completed = isAppTestCompleted(app);
        const matchesSearch =
          app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          app.developerNickname.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (categoryFilter === "test-completed") {
          return completed;
        }

        if (completed) {
          return false;
        }

        if (categoryFilter === "all") {
          return true;
        }

        return app.category === categoryFilter;
      })
      .sort((a, b) => {
        const rankA = a.developerId ? (developerRankById[a.developerId] ?? UNRANKED_SORT_VALUE) : UNRANKED_SORT_VALUE;
        const rankB = b.developerId ? (developerRankById[b.developerId] ?? UNRANKED_SORT_VALUE) : UNRANKED_SORT_VALUE;
        if (rankA !== rankB) return rankA - rankB;

        const participantDiff = (b.stats?.participants || 0) - (a.stats?.participants || 0);
        if (participantDiff !== 0) return participantDiff;

        const createdAtDiff = getCreatedAtMillis(b.createdAt) - getCreatedAtMillis(a.createdAt);
        if (createdAtDiff !== 0) return createdAtDiff;

        return a.name.localeCompare(b.name, "ko");
      });
  }, [apps, categoryFilter, developerRankById, searchTerm]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">앱 탐색</h1>
          <p className="text-muted-foreground text-lg">
            새로운 앱을 발견하고, 개발자를 돕고, 영감을 얻어가세요.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="앱 이름 또는 개발자 검색..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={categoryFilter === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {filteredApps.length === 0 ? (
        <div className="flex h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed text-center p-8">
          <p className="text-muted-foreground">
            {searchTerm || categoryFilter !== "all"
              ? "검색 조건에 맞는 앱이 없습니다."
              : "현재 모집 중인 앱이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app) => {
            const completed = isAppTestCompleted(app);
            const joinedStatus = joinedAppStatusById[app.id];
            const developerRank = app.developerId ? developerRankById[app.developerId] : undefined;
            const promotionBadge = getPromotionBadge(developerRank);

            return (
              <Card key={app.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-xl line-clamp-1">{app.name}</CardTitle>
                    <div className="flex flex-wrap justify-end gap-2">
                      {joinedStatus === "completed" && (
                        <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">
                          참여완료
                        </Badge>
                      )}
                      {(joinedStatus === "active" || joinedStatus === "pending") && (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                          참여중
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {completed
                          ? "테스트 완료"
                          : categories.find((c) => c.id === app.category)?.label || app.category}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <p>개발자: {app.developerNickname}</p>
                    {promotionBadge && <Badge className={promotionBadge.className}>{promotionBadge.label}</Badge>}
                    {promotionBadge && developerRank && (
                      <span className="text-xs font-semibold text-slate-500">참여 랭킹 #{developerRank}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{app.testDuration}일</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{app.stats?.participants || 0}명의 테스터</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button className="w-full h-11 font-bold" asChild>
                    <Link href={`/apps/${app.id}`}>
                      상세보기 및 참여요청
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
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