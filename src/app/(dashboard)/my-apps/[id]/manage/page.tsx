"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, deleteDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Loader2, ArrowLeft, Check, X, User, Settings, Info, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AppManagePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const appId = params.id;

  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeTesters, setActiveTesters] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editApp, setEditApp] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch app details
    const fetchApp = async () => {
      try {
        const docRef = doc(db, "apps", appId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.developerId !== user.uid) {
            toast.error("접근 권한이 없습니다.");
            router.push("/my-apps");
            return;
          }
          setApp({
            id: docSnap.id,
            ...data,
            stats: {
              participants: data.stats?.participants || 0,
              dailyParticipants: data.stats?.dailyParticipants || 0,
            },
            minTesters: data.minTesters || 20,
          });
          setEditApp({
            id: docSnap.id,
            ...data,
            minTesters: data.minTesters || 20,
            testDuration: data.testDuration || 14
          });
        } else {
          toast.error("앱을 찾을 수 없습니다.");
          router.push("/my-apps");
        }
      } catch (error) {
        console.error("Error fetching app:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApp();

    // Subscribe to participation requests
    const q = query(
      collection(db, "participations"),
      where("appId", "==", appId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending: any[] = [];
      const active: any[] = [];

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as any;
        if (data.status === "pending") {
          pending.push(data);
        } else if (data.status === "active" || data.status === "completed") {
          active.push(data);
        }
      });

      // Client-side sort since we might not have complex indexes for timestamp yet
      pending.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      active.sort((a, b) => (b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0) - (a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0));

      setPendingRequests(pending);
      setActiveTesters(active);
    });

    return () => unsubscribe();
  }, [user, appId, router]);

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

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editApp) return;

    setSavingSettings(true);
    try {
      const docRef = doc(db, "apps", appId);
      await updateDoc(docRef, {
        googleGroupLink: editApp.googleGroupLink || "",
        googleGroupEmail: editApp.googleGroupEmail || "",
        androidParticipationLink: editApp.androidParticipationLink || "",
        webParticipationLink: editApp.webParticipationLink || "",
        description: editApp.description || "",
        minTesters: Number(editApp.minTesters) || 20,
      });
      setApp({ ...app, ...editApp });
      toast.success("앱 설정이 저장되었습니다.");
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingSettings(false);
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
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{req.testerNickname}</p>
                          <p className="text-sm text-slate-500">{req.testerEmail}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            요청일: {req.createdAt ? formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true, locale: ko }) : '방금 전'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
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
                          disabled={processingId === req.id}
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
                  {activeTesters.map((tester) => (
                    <div
                      key={tester.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <span className="font-bold text-slate-500">
                            {tester.consecutiveDays || 0}일
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{tester.testerNickname}</p>
                            {tester.status === 'completed' && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">완료됨</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">{tester.testerEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">
                          진행률: {tester.targetDays ? Math.min(100, Math.round(((tester.consecutiveDays || 0) / tester.targetDays) * 100)) : 0}%
                        </p>
                        <p className="text-xs text-slate-500">
                          {tester.consecutiveDays || 0} / {tester.targetDays || 14} 일
                        </p>
                      </div>
                    </div>
                  ))}
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
                      value={editApp?.minTesters || ""}
                      onChange={(e) => setEditApp({ ...editApp, minTesters: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>테스트 기간 (변경 불가)</Label>
                    <Input value={editApp?.testDuration + "일"} disabled />
                  </div>
                </div>

                <div className="flex justify-end">
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