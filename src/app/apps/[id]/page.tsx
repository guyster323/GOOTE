"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { doc, collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp, onSnapshot, deleteDoc } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Users, Calendar, ExternalLink, MessageSquare, Send, User, Clock, CheckCircle2, Smartphone, Globe } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { createDailyTrackUrl } from "@/lib/daily-track";

export default function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const { user, profile } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showParticipationSteps, setShowParticipationSteps] = useState(false);
  const [participation, setParticipation] = useState<any>(null);
  const [checkingParticipation, setCheckingParticipation] = useState(false);

  const fetchParticipation = useCallback(async () => {
    if (!user || !id) return;
    setCheckingParticipation(true);
    try {
      const q = query(
        collection(db, "participations"),
        where("appId", "==", id),
        where("testerId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        setParticipation({ id: docSnap.id, ...data });
      } else {
        setParticipation(null);
      }
    } catch (error) {
      console.error("Error fetching participation:", error);
    } finally {
      setCheckingParticipation(false);
    }
  }, [id, user]);

  const fetchComments = useCallback(async () => {
    try {
      const q = query(
        collection(db, "comments"),
        where("appId", "==", id)
      );
      const querySnapshot = await getDocs(q);
      const fetchedComments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const sortedComments = fetchedComments.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setComments(sortedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const unsubscribeApp = onSnapshot(doc(db, "apps", id as string), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("App data loaded:", data.name, data.stats);
        setApp({
          id: docSnap.id,
          ...data,
          stats: {
            participants: data.stats?.participants || 0,
            dailyParticipants: data.stats?.dailyParticipants || 0,
            likes: data.stats?.likes || 0
          },
          androidParticipationLink: data.androidParticipationLink || data.androidLink,
          webParticipationLink: data.webParticipationLink || data.webLink
        });
      } else {
        toast.error("앱을 찾을 수 없습니다.");
        router.push("/explore");
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching app snapshot:", error);
      setLoading(false);
    });

    fetchComments();

    return () => unsubscribeApp();
  }, [id, router, fetchComments]);

  useEffect(() => {
    if (id && user) {
      fetchParticipation();
    } else {
      setParticipation(null);
    }
  }, [id, user, fetchParticipation]);

  // Safe date formatter
  const safeFormatDate = (timestamp: any) => {
    try {
      if (!timestamp) return '방금 전';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ko });
    } catch {
      return '날짜 정보 없음';
    }
  };

  const openTrackedDailyLink = async (type: "android" | "web") => {
    const directLink = type === "web" ? app?.webParticipationLink : app?.androidParticipationLink;
    if (!directLink) return;

    try {
      if (!participation?.id) {
        window.open(directLink, "_blank");
        return;
      }

      const trackUrl = await createDailyTrackUrl(participation.id, type);
      window.open(trackUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening tracked daily link:", error);
      window.open(directLink, "_blank", "noopener,noreferrer");
    }
  };

  const openGoogleGroupLink = () => {
    if (!app?.googleGroupLink) {
      toast.error("이 앱의 그룹스 가입 링크가 등록되지 않았습니다.");
      return false;
    }

    try {
      const parsed = new URL(app.googleGroupLink);
      const isGoogleGroups =
        parsed.hostname.includes("groups.google.com") &&
        parsed.pathname.includes("/g/");

      if (!isGoogleGroups) {
        toast.error("그룹스 링크 형식이 올바르지 않습니다. 개발자에게 링크 수정을 요청해주세요.");
        return false;
      }
    } catch {
      toast.error("그룹스 링크 형식이 올바르지 않습니다. 개발자에게 링크 수정을 요청해주세요.");
      return false;
    }

    const openedWindow = window.open(app.googleGroupLink, "_blank");
    if (!openedWindow) {
      toast.error("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
      return false;
    }

    return true;
  };

  const handleJoinRequest = async () => {
    if (!user) {
      toast.info("참여하려면 로그인이 필요합니다.");
      router.push(`/?redirect=/apps/${id}`);
      return;
    }

    const linkOpened = openGoogleGroupLink();
    if (!linkOpened) {
      return;
    }

    setRequesting(true);
    try {
      const requestParticipation = httpsCallable(functions, "requestParticipation");
      await requestParticipation({ appId: id });

      const joinedParticipation = {
        status: "active",
        testerId: user.uid,
        appId: id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      setParticipation(joinedParticipation);
      setShowParticipationSteps(false);

      toast.success("테스터로 등록되었습니다! 이제 앱을 다운로드할 수 있습니다.");

      // Delay fetch to allow server propagation
      setTimeout(() => {
        fetchParticipation();
      }, 1000);

    } catch (error: any) {
      console.error("Error joining participation:", error);
      toast.error(error.message || "참여 등록에 실패했습니다.");
      fetchParticipation();
    } finally {
      setRequesting(false);
    }
  };

  const handleLeaveParticipation = async () => {
    if (!participation?.id) {
      toast.error("참여 정보를 찾을 수 없습니다.");
      return;
    }

    const shouldLeave = window.confirm("이 앱 테스트에서 나가시겠어요?");
    if (!shouldLeave) return;

    setRequesting(true);
    try {
      await deleteDoc(doc(db, "participations", participation.id));
      setParticipation(null);
      setShowParticipationSteps(false);
      toast.success("테스트 참여를 종료했습니다.");
    } catch (error: any) {
      console.error("Error leaving participation:", error);
      const code = error?.code as string | undefined;
      if (code === "permission-denied") {
        toast.error("권한 문제로 나가기에 실패했습니다. 잠시 후 다시 시도해주세요.");
      } else {
        toast.error("나가기에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      await fetchParticipation();
    } finally {
      setRequesting(false);
    }
  };
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("댓글을 작성하려면 로그인이 필요합니다.");
      return;
    }
    if (!newComment.trim()) return;

    const commentContent = newComment.trim();
    setSubmittingComment(true);

    // Optimistic comment object
    const optimisticComment = {
      id: "temp-" + Date.now(),
      appId: id,
      userId: user.uid,
      userName: profile?.nickname || user.displayName || "익명",
      content: commentContent,
      createdAt: Timestamp.now()
    };

    try {
      // Add to local state immediately
      setComments([optimisticComment, ...comments]);
      setNewComment("");

      await addDoc(collection(db, "comments"), {
        appId: id,
        userId: user.uid,
        userName: profile?.nickname || user.displayName || "익명",
        content: commentContent,
        createdAt: serverTimestamp()
      });

      toast.success("댓글이 등록되었습니다.");
      // Background fetch to sync ID and exact server timestamp
      setTimeout(() => fetchComments(), 1000);
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("댓글 등록에 실패했습니다.");
      // Revert local change on error
      setComments(comments.filter(c => c.id !== optimisticComment.id));
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!app) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          ← 뒤로 가기
        </Button>

        <Card className="border-none shadow-2xl overflow-hidden rounded-3xl">
          <div className="h-3 bg-primary" />
          <CardHeader className="pt-8 px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <Badge className="mb-2">{app.category}</Badge>
                <CardTitle className="text-4xl font-black text-slate-900">{app.name}</CardTitle>
                <p className="text-slate-500 font-medium">개발자: {app.developerNickname}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 space-y-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                <Calendar className="h-5 w-5 text-primary mb-2" />
                <span className="text-[10px] text-slate-500 font-bold uppercase">테스트 기간</span>
                <span className="text-xl font-black text-slate-900">{app.testDuration}일</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                <Users className="h-5 w-5 text-indigo-500 mb-2" />
                <span className="text-[10px] text-slate-500 font-bold uppercase">총 참여</span>
                <span className="text-xl font-black text-slate-900">{app.stats?.participants || 0}명</span>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex flex-col items-center justify-center text-center ring-2 ring-green-100/50">
                <CheckCircle2 className="h-5 w-5 text-green-600 mb-2" />
                <span className="text-[10px] text-green-600 font-bold uppercase">오늘 참여</span>
                <span className="text-2xl font-black text-green-700">{app.stats?.dailyParticipants || 0}명</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                <Badge variant="outline" className="mb-1 text-[10px]">목표: {app.minTesters}명</Badge>
                <span className="text-[10px] text-slate-500 font-bold uppercase">모집 상태</span>
                <span className="text-xs font-black text-primary uppercase">recruiting</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                앱 설명
              </h3>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100 whitespace-pre-wrap">
                {app.description || "설명이 등록되지 않은 앱입니다."}
              </p>
            </div>

            <Separator className="bg-slate-100" />

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ExternalLink className="h-5 w-5 text-primary" />
                참여 방법 및 다운로드
              </h3>

              {checkingParticipation ? (
                <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm text-slate-500 font-medium">참여 정보 확인 중...</p>
                </div>
              ) : participation?.status === "active" || participation?.status === "completed" ? (
                <div className="grid gap-4">
                  <div className="bg-green-50 p-6 rounded-2xl border border-green-100 ring-2 ring-green-50">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-green-600 p-2 rounded-xl">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">테스터 등록 완료</h4>
                        <p className="text-xs text-green-700 font-medium">참여 중인 상태입니다. 매일 앱을 실행하여 참여를 유지해주세요.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                         <Smartphone className="h-4 w-4" /> 앱 다운로드 및 실행
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {app.androidParticipationLink ? (
                          <Button
                            className="h-14 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                            onClick={() => openTrackedDailyLink("android")}
                          >
                            <Smartphone className="mr-2 h-5 w-5" />
                            Android 참여 링크
                          </Button>
                        ) : (
                          <Button disabled className="h-14 rounded-xl bg-slate-100 text-slate-400">Android 링크 없음</Button>
                        )}
                        {app.webParticipationLink ? (
                          <Button
                            variant="outline"
                            className="h-14 rounded-xl border-slate-200 hover:bg-slate-50 font-bold"
                            onClick={() => openTrackedDailyLink("web")}
                          >
                            <Globe className="mr-2 h-5 w-5" />
                            Web 참여 링크
                          </Button>
                        ) : (
                          <Button disabled variant="outline" className="h-14 rounded-xl border-slate-100 text-slate-300">Web 링크 없음</Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className="h-12 rounded-xl border-slate-300 hover:bg-slate-100 font-bold"
                          onClick={openGoogleGroupLink}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          그룹스 재가입
                        </Button>
                        <Button
                          variant="destructive"
                          className="h-12 rounded-xl font-bold"
                          onClick={handleLeaveParticipation}
                          disabled={requesting}
                        >
                          {requesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          나가기
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : !showParticipationSteps ? (
                <div className="flex flex-col items-center justify-center py-10 bg-blue-50/50 rounded-2xl border border-blue-100 border-dashed gap-4">
                  <div className="text-center space-y-2 px-6">
                    <h4 className="font-bold text-slate-900 text-lg">테스터 참여하기</h4>
                    <p className="text-sm text-slate-600">
                      관심 있는 앱이라면 지금 바로 참여하여 개발자를 도와주세요!<br />
                      참여하기를 누르면 그룹 가입 및 다운로드 안내가 시작됩니다.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="h-14 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-black shadow-xl shadow-primary/20"
                    onClick={() => setShowParticipationSteps(true)}
                  >
                    <Users className="mr-2 h-5 w-5" />
                    참여하기
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="p-6 rounded-2xl border bg-blue-50 border-blue-200 ring-2 ring-blue-100">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-black">1</span>
                      <h4 className="font-bold text-slate-900 text-lg">구글 그룹스 가입</h4>
                    </div>
                    <p className="text-sm text-slate-700 ml-11 leading-relaxed mb-6">
                      테스터 권한을 얻기 위해 먼저 아래 버튼을 눌러 구글 그룹스에 가입해주세요.<br />
                      가입 시 <strong>&quot;그룹 가입&quot;</strong> 버튼을 누르면 즉시 테스터로 등록됩니다.
                    </p>

                    <Button
                      size="lg"
                      className="ml-11 h-14 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black shadow-xl"
                      disabled={requesting}
                      onClick={handleJoinRequest}
                    >
                      {requesting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Users className="mr-2 h-5 w-5" />}
                      그룹스 가입 및 참여 완료
                    </Button>

                    {!app.googleGroupLink && (
                      <p className="text-xs text-red-500 mt-2 ml-11 font-bold">
                        * 현재 앱의 그룹스 가입 링크가 등록되지 않아 참여가 불가능합니다.
                      </p>
                    )}
                  </div>

                  <div className="p-6 rounded-2xl border bg-slate-50 border-slate-200 opacity-50">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-white text-sm font-black">2</span>
                      <h4 className="font-bold text-slate-500 text-lg">앱 다운로드 및 실행</h4>
                    </div>
                    <p className="text-sm text-slate-500 ml-11">
                      1단계를 완료하면 이곳에 플레이스토어 다운로드 링크가 나타납니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>

          {!participation && showParticipationSteps && (
            <CardFooter className="px-8 pb-10 flex flex-col gap-4">
              <div className="w-full p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-center">
                <p className="text-xs text-blue-700 font-bold">
                  위의 1단계 버튼을 눌러 그룹 가입을 완료하면<br />
                  자동으로 테스터로 등록되어 앱 다운로드가 가능해집니다.
                </p>
              </div>
            </CardFooter>
          )}
        </Card>

        {/* Comments Section */}
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="pt-8 px-8">
            <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              피드백 및 개선 요청 ({comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-6">
            <form onSubmit={handleSubmitComment} className="relative group">
              <Textarea
                placeholder={user ? "앱에 대한 피드백이나 개선 요청을 남겨주세요." : "로그인 후 댓글을 남길 수 있습니다."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={!user || submittingComment}
                className="min-h-[100px] rounded-2xl border-slate-200 focus:ring-primary pr-12 transition-all resize-none"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!user || !newComment.trim() || submittingComment}
                className="absolute right-3 bottom-3 rounded-xl shadow-lg shadow-primary/20"
              >
                {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>

            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  첫 번째 피드백을 남겨보세요!
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {comments.map((comment) => (
                    <div key={comment.id} className="py-6 first:pt-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{comment.userName}</p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="h-3 w-3" />
                              {safeFormatDate(comment.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-600 leading-relaxed pl-12 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
