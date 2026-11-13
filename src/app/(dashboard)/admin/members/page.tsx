"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { fetchMemberDirectory, type MemberDirectoryEntry } from "@/lib/member-data";
import {
  canRemoveMember,
  emptyBoundRows,
  publishBoundRows,
  removeBoundRow,
  startSensitiveGeneration,
  visibleBoundRows,
  viewerIdentityKey,
  type BoundRows,
} from "@/lib/sensitive-request";
import { useAuth } from "@/hooks/use-auth";
import { isAdminRole } from "@/lib/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Shield, Search, UserX, Users } from "lucide-react";

type Member = MemberDirectoryEntry;

const getDisplayName = (member: Member) => member.nickname?.trim() || "익명 사용자";

const emailLabel = (member: Member) => member.email || "이메일 없음";

export default function AdminMembersPage() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuth();
  const [memberSnapshot, setMemberSnapshot] = useState<BoundRows<Member>>(emptyBoundRows());
  const [search, setSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  const isAdmin = isAdminRole(profile?.role);
  const viewerKey = viewerIdentityKey({
    uid: user?.uid,
    email: user?.email,
    emailVerified: user?.emailVerified,
    role: profile?.role,
    scope: "members",
  });
  const generationRef = useRef(0);
  const identityRef = useRef(viewerKey);
  identityRef.current = viewerKey;

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast.error("관리자만 접근할 수 있습니다.");
      router.replace("/dashboard");
    }
  }, [isAdmin, isLoading, router]);

  useEffect(() => {
    const generation = startSensitiveGeneration(generationRef.current);
    generationRef.current = generation;
    const identityKey = viewerKey;
    if (isLoading || !isAdmin) {
      setLoadingMembers(false);
      return;
    }
    setLoadingMembers(true);
    let cancelled = false;

    const loadMembers = async () => {
      try {
        const nextMembers = await fetchMemberDirectory();
        if (cancelled) return;
        nextMembers.sort((a, b) => {
          const roleDiff = Number(b.role === "admin") - Number(a.role === "admin");
          if (roleDiff !== 0) return roleDiff;
          return getDisplayName(a).localeCompare(getDisplayName(b), "ko");
        });
        const published = publishBoundRows(generationRef.current, identityRef.current, {
          generation,
          identityKey,
          rows: nextMembers,
        });
        if (published) setMemberSnapshot(published);
      } catch (error) {
        console.error("Error loading members:", error);
        const published = publishBoundRows(generationRef.current, identityRef.current, {
          generation,
          identityKey,
          rows: [],
        });
        if (!published) return;
        setMemberSnapshot(published);
        toast.error("회원 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled && generationRef.current === generation) setLoadingMembers(false);
      }
    };

    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, isLoading, viewerKey]);

  const members = visibleBoundRows(memberSnapshot, viewerKey);
  const filteredMembers = members.filter((member) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;

    const haystack = [member.nickname, member.email, member.uid, member.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(keyword);
  });

  const adminCount = members.filter((member) => member.role === "admin").length;
  const protectedCount = members.filter((member) => member.role === "admin").length;

  const handleKickUser = async (member: Member) => {
    const targetUserId = member.id;
    const targetLabel = getDisplayName(member);

    if (!targetUserId) {
      toast.error("탈퇴시킬 사용자 정보를 찾을 수 없습니다.");
      return;
    }

    if (!canRemoveMember(user?.uid, member)) {
      toast.error("보호된 관리자 계정은 탈퇴시킬 수 없습니다.");
      return;
    }

    if (!confirm(`${targetLabel} 계정을 탈퇴 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    const identityAtKick = identityRef.current;
    setKickingUserId(targetUserId);
    try {
      const deleteUserByAdmin = httpsCallable(functions, "deleteUserByAdmin");
      await deleteUserByAdmin({ targetUserId });
      if (identityRef.current !== identityAtKick) return;
      const generation = startSensitiveGeneration(generationRef.current);
      generationRef.current = generation;
      setMemberSnapshot((current) => removeBoundRow(current, targetUserId, identityAtKick));
      toast.success("계정을 탈퇴 처리했습니다.");
      try {
        const refreshed = await fetchMemberDirectory();
        const published = publishBoundRows(generationRef.current, identityRef.current, {
          generation,
          identityKey: identityAtKick,
          rows: refreshed,
        });
        if (published) setMemberSnapshot(published);
      } catch (refreshError) {
        console.error("Error refreshing members after removal:", refreshError);
      }
    } catch (error) {
      console.error("Error deleting user by admin:", error);
      toast.error("계정 탈퇴 처리 중 오류가 발생했습니다.");
    } finally {
      setKickingUserId(null);
    }
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-[0.24em]">Admin Console</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">회원 관리</h1>
          <p className="text-lg text-muted-foreground">
            전체 회원을 조회하고 관리자 권한으로 계정을 탈퇴 처리할 수 있습니다.
          </p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1 text-sm font-semibold">
          전체 회원 {members.length}명
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>전체 회원</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">{members.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>관리자 계정</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">{adminCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>보호된 계정</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">{protectedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Users className="h-5 w-5 text-primary" />
            전체 회원 목록
          </CardTitle>
          <CardDescription>
            닉네임, 이메일, UID로 검색할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="닉네임, 이메일, UID 검색"
              className="pl-10"
            />
          </div>

          {loadingMembers ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((member) => {
                const isProtected = member.id === user?.uid || member.role === "admin";
                const testsJoined = member.stats?.testsJoined || 0;
                const testsCompleted = member.stats?.testsCompleted || 0;
                const appsRegistered = member.stats?.appsRegistered || 0;

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-4">
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
                          <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                            {member.role === "admin" ? "관리자" : "사용자"}
                          </Badge>
                          {member.role === "admin" && (
                            <Badge variant="outline">보호 계정</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{emailLabel(member)}</p>
                        <p className="text-xs text-slate-400">UID: {member.uid || member.id}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:items-end">
                      <div className="grid grid-cols-3 gap-2 text-center md:min-w-[300px]">
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">앱</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{appsRegistered}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">참여</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{testsJoined}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">완료</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{testsCompleted}</p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        {isProtected ? (
                          <Button variant="outline" size="sm" disabled>
                            보호됨
                          </Button>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleKickUser(member)}
                            disabled={kickingUserId === member.id}
                          >
                            {kickingUserId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                강퇴
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
