"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Users, Trophy } from "lucide-react";

type RankingUser = {
  id: string;
  email?: string;
  nickname?: string;
  profileImage?: string;
  stats?: {
    testsJoined?: number;
    testsCompleted?: number;
    totalConsecutiveDays?: number;
  };
};

const getCrownStyle = (rank: number) => {
  if (rank === 1) {
    return {
      iconClassName: "text-amber-500 drop-shadow-[0_6px_18px_rgba(245,158,11,0.35)]",
      badgeClassName: "bg-amber-50 text-amber-700 border-amber-200",
      label: "Gold Crown",
    };
  }

  if (rank === 2) {
    return {
      iconClassName: "text-slate-400 drop-shadow-[0_6px_18px_rgba(148,163,184,0.35)]",
      badgeClassName: "bg-slate-100 text-slate-700 border-slate-200",
      label: "Silver Crown",
    };
  }

  return {
    iconClassName: "text-orange-700 drop-shadow-[0_6px_18px_rgba(194,120,3,0.28)]",
    badgeClassName: "bg-orange-50 text-orange-700 border-orange-200",
    label: "Bronze Crown",
  };
};

const getDisplayName = (user: RankingUser) =>
  user.nickname?.trim() || user.email?.split("@")[0] || "익명 사용자";

export default function RankingPage() {
  const [members, setMembers] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const fetchedMembers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RankingUser[];

        setMembers(fetchedMembers);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching ranking users:", error);
        setMembers([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const rankedMembers = useMemo(() => {
    return [...members]
      .sort((a, b) => {
        const joinedDiff = (b.stats?.testsJoined || 0) - (a.stats?.testsJoined || 0);
        if (joinedDiff !== 0) return joinedDiff;

        const completedDiff = (b.stats?.testsCompleted || 0) - (a.stats?.testsCompleted || 0);
        if (completedDiff !== 0) return completedDiff;

        return getDisplayName(a).localeCompare(getDisplayName(b), "ko");
      })
      .map((member, index) => ({
        ...member,
        rank: index + 1,
        testsJoined: member.stats?.testsJoined || 0,
        testsCompleted: member.stats?.testsCompleted || 0,
        totalConsecutiveDays: member.stats?.totalConsecutiveDays || 0,
      }));
  }, [members]);

  const podiumMembers = rankedMembers.slice(0, 3);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Trophy className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-[0.24em]">Leaderboard</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">테스트 참여 순위</h1>
          <p className="text-lg text-muted-foreground">
            GOOTE 전체 멤버의 테스트 참여 횟수를 기준으로 순위를 집계합니다.
          </p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1 text-sm font-semibold">
          전체 회원 {rankedMembers.length}명
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {podiumMembers.map((member) => {
          const crown = getCrownStyle(member.rank);
          return (
            <Card key={member.id} className="overflow-hidden border-none shadow-lg">
              <CardHeader className="bg-slate-900 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                      #{member.rank}
                    </p>
                    <CardTitle className="mt-2 text-2xl">{getDisplayName(member)}</CardTitle>
                  </div>
                  <Crown className={`h-10 w-10 ${crown.iconClassName}`} aria-label={crown.label} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-4">
                  {member.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.profileImage}
                      alt={getDisplayName(member)}
                      className="h-16 w-16 rounded-2xl object-cover ring-4 ring-slate-100"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-600">
                      {getDisplayName(member).slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <Badge className={crown.badgeClassName}>{member.testsJoined}회 참여</Badge>
                    <p className="mt-3 text-sm text-slate-500">{member.email || "이메일 없음"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">완료</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{member.testsCompleted}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">연속일</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{member.totalConsecutiveDays}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-black text-slate-900">전체 회원 순위</CardTitle>
            <p className="mt-1 text-sm text-slate-500">가입된 모든 멤버를 한 번에 볼 수 있습니다.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            <Users className="h-4 w-4" />
            All Members
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rankedMembers.map((member) => {
            const crown = member.rank <= 3 ? getCrownStyle(member.rank) : null;

            return (
              <div
                key={member.id}
                className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white">
                    {member.rank}
                  </div>
                  {member.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.profileImage}
                      alt={getDisplayName(member)}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-600">
                      {getDisplayName(member).slice(0, 1)}
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-slate-900">{getDisplayName(member)}</p>
                      {crown && <Crown className={`h-5 w-5 ${crown.iconClassName}`} aria-label={crown.label} />}
                    </div>
                    <p className="text-sm text-slate-500">{member.email || "이메일 없음"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:min-w-[320px]">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">참여</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{member.testsJoined}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">완료</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{member.testsCompleted}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">연속일</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{member.totalConsecutiveDays}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
