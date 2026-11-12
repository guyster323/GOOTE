"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { doc, collection, query, where, onSnapshot, deleteDoc, getDocs, documentId } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { isAdminRole } from "@/lib/admin";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Loader2, ArrowLeft, Check, Settings, Info, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEffectiveConsecutiveDays } from "@/lib/test-period";

type TesterProfile = {
  email?: string;
  nickname?: string;
};

type ParticipationRecord = {
  id: string;
  consecutiveDays?: number;
  createdAt?: unknown;
  lastCheckIn?: unknown;
  updatedAt?: unknown;
  status?: string;
  targetDays?: number;
  testerId?: string;
  testerEmail?: string;
  testerNickname?: string;
};

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const getPreferredNickname = (nickname?: string, email?: string) => {
  const trimmedNickname = nickname?.trim();
  if (trimmedNickname) return trimmedNickname;

  const trimmedEmail = email?.trim();
  if (trimmedEmail) return trimmedEmail.split("@")[0];

  return "익명";
};

const getPreferredEmail = (email?: string) => {
  const trimmedEmail = email?.trim();
  return trimmedEmail || "이메일 없음";
};

const getAvatarLabel = (nickname?: string, email?: string) => {
  return getPreferredNickname(nickname, email).replace(/\s+/g, "").slice(0, 2).toUpperCase();
};

export default function AppManagePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const appId = resolvedParams.id;
  const { user, profile } = useAuth();
  const isPrimaryAdmin = isAdminRole(profile?.role);

  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<ParticipationRecord[]>([]);
  const [activeTesters, setActiveTesters] = useState<ParticipationRecord[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [editApp, setEditApp] = useState<any>(null);

  const safeFormatDate = (timestamp: any) => {
    try {
      if (!timestamp) return '방금 전';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      // Check if date is valid
      if (isNaN(date.getTime())) return '날짜 오류';
      return formatDistanceToNow(date, { addSuffix: true, locale: ko });
    } catch {
      return '날짜 정보 없음';
    }
  };

  useEffect(() => {
    // Critical: Wait for both user and appId to be valid before doing anything
    if (!user || !appId || typeof appId !== 'string') return;
    let cancelled = false;

    console.log("Starting subscriptions for appId:", appId);
    setLoading(true);

    // Real-time subscription for app details
    const unsubscribeApp = onSnapshot(doc(db, "apps", appId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.developerId !== user.uid && !isPrimaryAdmin) {
          toast.error("접근 권한이 없습니다.");
          router.push("/my-apps");
          return;
        }

        const appInfo = {
          id: docSnap.id,
          ...data,
          stats: {
            participants: data.stats?.participants || 0,
            dailyParticipants: data.stats?.dailyParticipants || 0,
          },
          minTesters: data.minTesters || 20,
        };

        setApp(appInfo);
        setEditApp((prev: any) => prev ? prev : {
          id: docSnap.id,
          ...data,
          minTesters: data.minTesters || 20,
          testDuration: data.testDuration || 14
        });
      } else {
        toast.error("앱을 찾을 수 없습니다.");
        router.push("/my-apps");
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching app snapshot:", error);
      toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
      setLoading(false);
    });

    // Subscribe to participation requests
    const q = query(
      collection(db, "participations"),
      where("appId", "==", appId)
    );

    const unsubscribeParticipations = onSnapshot(q, (snapshot) => {
      void (async () => {
        const records = snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
        })) as ParticipationRecord[];

        const testerIds = Array.from(new Set(
          records
            .map((record) => record.testerId?.trim())
            .filter((testerId): testerId is string => Boolean(testerId))
        ));

        const profileMap = new Map<string, TesterProfile>();

        for (const testerIdChunk of chunk(testerIds, 10)) {
          const usersSnapshot = await getDocs(
            query(collection(db, "users"), where(documentId(), "in", testerIdChunk))
          );

          usersSnapshot.forEach((userDoc) => {
            const profileData = userDoc.data() as TesterProfile;
            profileMap.set(userDoc.id, profileData);
          });
        }

        const mergedRecords = records.map((record) => {
          const profileData = record.testerId ? profileMap.get(record.testerId) : undefined;
          const testerEmail = record.testerEmail?.trim() || profileData?.email?.trim() || "";
          const testerNickname = record.testerNickname?.trim() || profileData?.nickname?.trim() || "";

          return {
            ...record,
            testerEmail: getPreferredEmail(testerEmail),
            testerNickname: getPreferredNickname(testerNickname, testerEmail),
          };
        });

        const pending: ParticipationRecord[] = [];
        const active: ParticipationRecord[] = [];

        mergedRecords.forEach((record) => {
          if (record.status === "pending") {
            pending.push(record);
          } else if (record.status === "active" || record.status === "completed") {
            active.push(record);
          }
        });

        const safeTime = (ts: unknown) => {
          try {
            const maybeTimestamp = ts as { toMillis?: () => number } | null;
            if (maybeTimestamp?.toMillis) return maybeTimestamp.toMillis();
            return ts ? new Date(ts as string | number | Date).getTime() : 0;
          } catch {
            return 0;
          }
        };

        pending.sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));
        active.sort((a, b) => safeTime(b.updatedAt) - safeTime(a.updatedAt));

        if (cancelled) return;

        setPendingRequests(pending);
        setActiveTesters(active);
      })().catch((error) => {
        console.error("Error enriching participation records:", error);
      });
    }, (error) => {
      console.error("Error fetching participations snapshot:", error);
    });

    return () => {
      cancelled = true;
      unsubscribeApp();
      unsubscribeParticipations();
    };
  }, [user, appId, router, isPrimaryAdmin]);

  const handleApprove = async (participationId: string) => {
    setProcessingId(participationId);
    try {
      const approveTester = httpsCallable(functions, "approveTester");
      await approveTester({ participationId });
      toast.success("테스터를 승인했습니다.");
    } catch (error) {
      console.error("Error approving tester:", error);
      toast.error("승인 중 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (participationId: string) => {
    if (!confirm("정말 이 요청을 거절하시겠습니까?")) return;

    setProcessingId(participationId);
    try {
      // 거절은 문서를 삭제하거나 status를 rejected로 변경
      // 여기서는 문서를 삭제하는 것으로 구현 (또는 status: rejected 업데이트)
      await deleteDoc(doc(db, "participations", participationId));
      toast.success("요청을 거절(삭제)했습니다.");
    } catch (error) {
      console.error("Error rejecting tester:", error);
      toast.error("거절 중 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleKickUser = async (targetUserId: string | undefined, targetLabel: string) => {
    if (!targetUserId) {
      toast.error("탈퇴시킬 사용자 정보를 찾을 수 없습니다.");
      return;
    }

    if (!confirm(`${targetLabel} 계정을 탈퇴 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setKickingUserId(targetUserId);
    try {
      const deleteUserByAdmin = httpsCallable(functions, "deleteUserByAdmin");
      await deleteUserByAdmin({ targetUserId });
      toast.success("계정을 탈퇴 처리했습니다.");
    } catch (error) {
      console.error("Error deleting user by admin:", error);
      toast.error("계정 탈퇴 처리 중 오류가 발생했습니다.");
    } finally {
      setKickingUserId(null);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editApp) return;

    const updateApp = httpsCallable(functions, "updateApp");
    const payload = {
      appId,
      name: String(editApp.name || "").trim(),
      androidParticipationLink: String(editApp.androidParticipationLink || "").trim(),
      webParticipationLink: String(editApp.webParticipationLink || "").trim(),
      googleGroupEmail: String(editApp.googleGroupEmail || "").trim(),
      googleGroupLink: String(editApp.googleGroupLink || "").trim(),
      packageName: String(editApp.packageName || "").trim(),
      developerConsoleId: String(editApp.developerConsoleId || "").trim(),
      description: String(editApp.description || "").trim(),
      category: String(editApp.category || ""),
      testDuration: Number(editApp.testDuration),
      minTesters: Number(editApp.minTesters),
    };

    setSavingSettings(true);
    try {
      await updateApp(payload);
      setApp({
        ...app,
        ...payload,
      });
      setEditApp((prev: any) => prev ? { ...prev, ...payload } : prev);
      toast.success("앱 설정이 저장되었습니다.");
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!confirm("정말로 이 앱을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 참여 정보가 함께 삭제됩니다.")) {
      return;
    }

    // Double check for safety
    const appName = prompt(`삭제를 확인하려면 앱 이름 "${app.name}"을(를) 입력하세요.`);
    if (appName !== app.name) {
      toast.error("앱 이름이 일치하지 않습니다.");
      return;
    }

    setDeleting(true);
    try {
      const deleteAppFunction = httpsCallable(functions, "deleteApp");
      await deleteAppFunction({ appId });

      toast.success("앱이 성공적으로 삭제되었습니다.");
      router.push("/my-apps");
    } catch (error) {
      console.error("Error deleting app:", error);
      toast.error("앱 삭제 중 오류가 발생했습니다.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!app) return null;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 md:px-0">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push("/my-apps")}
          className="mb-4 pl-0 hover:pl-2 transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          내 앱 목록으로 돌아가기
        </Button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
              {app.name} 관리
            </h1>
            <p className="text-muted-foreground">
              테스터 요청을 승인하고 진행 상황을 모니터링하세요.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="px-3 py-1 text-sm">
              목표: {app.minTesters}명
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              현재: {app.stats?.participants || 0}명
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            승인 대기
            {pendingRequests.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">참여 중인 테스터</TabsTrigger>
          <TabsTrigger value="settings">앱 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>승인 대기 목록</CardTitle>
              <CardDescription>
                테스트 참여를 요청한 사용자들입니다. 승인하면 앱 설치 링크가 메일로 발송됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  대기 중인 요청이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                          {getAvatarLabel(req.testerNickname, req.testerEmail)}
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-black tracking-tight text-slate-900">{String(req.testerNickname || '익명')}</p>
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">승인 대기</Badge>
                          </div>
                          <p className="break-all font-mono text-sm text-slate-600">{String(req.testerEmail || '이메일 없음')}</p>
                          <p className="text-xs font-medium text-slate-400">요청일 {safeFormatDate(req.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {isPrimaryAdmin && req.testerId && req.testerId !== user?.uid && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleKickUser(req.testerId, String(req.testerNickname || req.testerEmail || "사용자"))}
                            disabled={kickingUserId === req.testerId}
                          >
                            {kickingUserId === req.testerId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "강퇴"
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleReject(req.id)}
                          disabled={processingId === req.id}
                        >
                          거절
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => handleApprove(req.id)}
                          disabled={processingId === req.id || app.developerId !== user?.uid}
                          title={app.developerId !== user?.uid ? "테스터 승인은 앱 소유자만 할 수 있습니다." : undefined}
                        >
                          {processingId === req.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              승인
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>참여 중인 테스터</CardTitle>
              <CardDescription>
                현재 테스트에 참여 중이거나 완료한 테스터 목록입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeTesters.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  아직 참여 중인 테스터가 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeTesters.map((tester) => {
                    const effectiveConsecutiveDays = getEffectiveConsecutiveDays(tester);

                    return (
                      <div
                        key={tester.id}
                        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Day</span>
                            <span className="text-lg font-black">{effectiveConsecutiveDays}일</span>
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-black tracking-tight text-slate-900">{String(tester.testerNickname || '익명')}</p>
                              {tester.status === 'completed' && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700">완료됨</Badge>
                              )}
                            </div>
                            <p className="break-all font-mono text-sm text-slate-600">{String(tester.testerEmail || '이메일 없음')}</p>
                            <p className="text-xs font-medium text-slate-400">최근 활동 {safeFormatDate(tester.updatedAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 md:justify-end">
                          <div className="min-w-[112px] rounded-xl bg-slate-50 px-3 py-2 text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              진행률: {tester.targetDays ? Math.min(100, Math.round((effectiveConsecutiveDays / tester.targetDays) * 100)) : 0}%
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              {effectiveConsecutiveDays} / {tester.targetDays || 14} 일
                            </p>
                          </div>
                          {isPrimaryAdmin && tester.testerId && tester.testerId !== user?.uid && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleKickUser(tester.testerId, String(tester.testerNickname || tester.testerEmail || "사용자"))}
                              disabled={kickingUserId === tester.testerId}
                            >
                              {kickingUserId === tester.testerId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "강퇴"
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                앱 정보 및 그룹 설정
              </CardTitle>
              <CardDescription>
                테스터들이 참여할 때 필요한 그룹 링크와 앱 정보를 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">앱 이름</Label>
                    <Input
                      id="name"
                      value={editApp?.name || ""}
                      onChange={(e) => setEditApp({ ...editApp, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="androidParticipationLink">Android 테스트 참여 링크</Label>
                    <Input
                      id="androidParticipationLink"
                      placeholder="https://play.google.com/apps/testing/..."
                      value={editApp?.androidParticipationLink || ""}
                      onChange={(e) => setEditApp({ ...editApp, androidParticipationLink: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webParticipationLink">Web 테스트 참여 링크</Label>
                    <Input
                      id="webParticipationLink"
                      placeholder="https://play.google.com/apps/testing/..."
                      value={editApp?.webParticipationLink || ""}
                      onChange={(e) => setEditApp({ ...editApp, webParticipationLink: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="packageName">패키지 이름</Label>
                    <Input
                      id="packageName"
                      placeholder="com.example.myapp"
                      value={editApp?.packageName || ""}
                      onChange={(e) => setEditApp({ ...editApp, packageName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="developerConsoleId">Play Console 개발자 ID</Label>
                    <Input
                      id="developerConsoleId"
                      placeholder="12345678901234567890"
                      inputMode="numeric"
                      value={editApp?.developerConsoleId || ""}
                      onChange={(e) => setEditApp({ ...editApp, developerConsoleId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">카테고리</Label>
                  <Select
                    value={editApp?.category || "utility"}
                    onValueChange={(value) => setEditApp({ ...editApp, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="game">게임</SelectItem>
                      <SelectItem value="utility">유틸리티</SelectItem>
                      <SelectItem value="productivity">생산성</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="googleGroupLink">구글 그룹스 링크</Label>
                    <Input
                      id="googleGroupLink"
                      placeholder="https://groups.google.com/g/your-group"
                      value={editApp?.googleGroupLink || ""}
                      onChange={(e) => setEditApp({ ...editApp, googleGroupLink: e.target.value })}
                    />
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      테스터가 앱 다운로드 권한을 위해 가입할 그룹 링크입니다.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="googleGroupEmail">구글 그룹스 이메일</Label>
                    <Input
                      id="googleGroupEmail"
                      placeholder="your-group@googlegroups.com"
                      value={editApp?.googleGroupEmail || ""}
                      onChange={(e) => setEditApp({ ...editApp, googleGroupEmail: e.target.value })}
                    />
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      그룹스 관리 이메일 주소입니다.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">앱 설명</Label>
                  <textarea
                    id="description"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="앱에 대한 상세 설명을 입력하세요."
                    value={editApp?.description || ""}
                    onChange={(e) => setEditApp({ ...editApp, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minTesters">목표 테스터 수</Label>
                    <Input
                      id="minTesters"
                      type="number"
                      value={editApp?.minTesters || 20}
                      onChange={(e) => setEditApp(editApp ? { ...editApp, minTesters: e.target.value } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>테스트 기간 (변경 불가)</Label>
                    <Input value={(editApp?.testDuration || 14) + "일"} disabled />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t mt-8">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-red-600">위험 구역</h3>
                    <p className="text-xs text-slate-500">앱을 삭제하면 모든 데이터가 영구적으로 제거됩니다.</p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteApp}
                    disabled={deleting || app.developerId !== user?.uid}
                    title={app.developerId !== user?.uid ? "앱 삭제는 앱 소유자만 할 수 있습니다." : undefined}
                  >
                    {deleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    앱 삭제
                  </Button>
                </div>

                <div className="flex justify-end border-t pt-6">
                  <Button type="submit" disabled={savingSettings}>
                    {savingSettings ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    설정 저장
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
