"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { doc, collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp, onSnapshot, deleteDoc, updateDoc } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Users, Calendar, ExternalLink, MessageSquare, Send, User, Clock, CheckCircle2, Smartphone, Globe, Handshake, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { createDailyTrackUrl } from "@/lib/daily-track";
import { navigateExternalWindow, openPendingExternalWindow } from "@/lib/external-window";
import { isValidGoogleGroupUrl } from "@/lib/google-groups";
import { resolvePlayParticipationLink } from "@/lib/play-links";
import { isAppTestCompleted } from "@/lib/test-period";

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
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyTargetName, setReplyTargetName] = useState("");
  const [replyComment, setReplyComment] = useState("");
  const [submittingReplyToCommentId, setSubmittingReplyToCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentValue, setEditCommentValue] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [showParticipationSteps, setShowParticipationSteps] = useState(false);
  const [participation, setParticipation] = useState<any>(null);
  const [checkingParticipation, setCheckingParticipation] = useState(false);
  const [crossStatus, setCrossStatus] = useState<{ hasMyApps: boolean; isDeveloperTestingMine: boolean } | null>(null);
  const [checkingCrossStatus, setCheckingCrossStatus] = useState(false);

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

  useEffect(() => {
    const fetchCrossStatus = async () => {
      if (!user || !app?.developerId) {
        setCrossStatus(null);
        return;
      }

      setCheckingCrossStatus(true);
      try {
        const myAppsSnap = await getDocs(
          query(
            collection(db, "apps"),
            where("developerId", "==", user.uid),
            where("status", "!=", "deleted")
          )
        );

        const myApps = myAppsSnap.docs.map((d) => d.id);
        if (myApps.length === 0) {
          setCrossStatus({ hasMyApps: false, isDeveloperTestingMine: false });
          return;
        }

        let isDeveloperTestingMine = false;
        for (let j = 0; j < myApps.length; j += 10) {
          const appIds = myApps.slice(j, j + 10);
          const crossSnap = await getDocs(
            query(
              collection(db, "participations"),
              where("testerId", "==", app.developerId),
              where("appId", "in", appIds),
              where("status", "in", ["active", "completed"])
            )
          );

          if (!crossSnap.empty) {
            isDeveloperTestingMine = true;
            break;
          }
        }

        setCrossStatus({ hasMyApps: true, isDeveloperTestingMine });
      } catch (error) {
        console.error("Error fetching cross status:", error);
        setCrossStatus(null);
      } finally {
        setCheckingCrossStatus(false);
      }
    };

    fetchCrossStatus();
  }, [app?.developerId, user]);

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

  const getCommentTimestamp = (timestamp: any) => {
    if (!timestamp) return 0;
    return timestamp.toMillis ? timestamp.toMillis() : 0;
  };

  const handleBackNavigation = useCallback(() => {
    if (typeof window === "undefined") {
      router.push("/explore");
      return;
    }

    const hasSameOriginReferrer = document.referrer.startsWith(window.location.origin);
    const hasBrowserHistory = window.history.length > 1;

    if (hasSameOriginReferrer || hasBrowserHistory) {
      router.back();
      return;
    }

    router.push("/explore");
  }, [router]);

  const openTrackedDailyLink = async (type: "android" | "web") => {
    const directLink = resolvePlayParticipationLink({
      type,
      androidParticipationLink: app?.androidParticipationLink,
      webParticipationLink: app?.webParticipationLink,
    });
    if (!directLink) return;

    try {
      const parsed = new URL(directLink);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        toast.error("안전하지 않은 외부 링크 형식입니다.");
        return;
      }
    } catch {
      toast.error("외부 링크 형식이 올바르지 않습니다.");
      return;
    }

    const popup = openPendingExternalWindow();

    try {
      if (!participation?.id) {
        if (popup) {
          navigateExternalWindow(popup, directLink);
        } else {
          window.location.assign(directLink);
        }
        return;
      }

      const trackUrl = await createDailyTrackUrl(participation.id, type);
      if (popup) {
        navigateExternalWindow(popup, trackUrl);
      } else {
        window.location.assign(trackUrl);
      }
    } catch (error) {
      console.error("Error opening tracked daily link:", error);
      if (popup) {
        navigateExternalWindow(popup, directLink);
      } else {
        window.location.assign(directLink);
      }
    }
  };

  const openGoogleGroupLink = () => {
    if (!app?.googleGroupLink) {
      toast.error("이 앱의 그룹스 가입 링크가 등록되지 않았습니다.");
      return false;
    }

    if (!isValidGoogleGroupUrl(app.googleGroupLink)) {
      toast.error("그룹스 링크 형식이 올바르지 않습니다. 개발자에게 링크 수정을 요청해주세요.");
      return false;
    }

    const popup = openPendingExternalWindow();
    if (popup) {
      navigateExternalWindow(popup, app.googleGroupLink);
    } else {
      window.location.assign(app.googleGroupLink);
    }
    return true;
  };

  const handleJoinRequest = async () => {
    if (!user) {
      toast.info("참여하려면 로그인이 필요합니다.");
      router.push(`/?redirect=/apps/${id}`);
      return;
    }

    if (!app?.googleGroupLink) {
      toast.error("이 앱의 그룹스 가입 링크가 등록되지 않았습니다.");
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
  const closeReplyComposer = () => {
    setReplyingToCommentId(null);
    setReplyTargetName("");
    setReplyComment("");
  };

  const closeEditComposer = () => {
    setEditingCommentId(null);
    setEditCommentValue("");
  };

  const handleOpenReplyComposer = (comment: any) => {
    closeEditComposer();
    setReplyingToCommentId(comment.parentId || comment.id);
    setReplyTargetName(comment.userName || "익명");
    setReplyComment("");
  };

  const handleOpenEditComposer = (comment: any) => {
    closeReplyComposer();
    setEditingCommentId(comment.id);
    setEditCommentValue(comment.content || "");
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

    const optimisticComment = {
      id: "temp-" + Date.now(),
      appId: id,
      userId: user.uid,
      userName: profile?.nickname || user.displayName || "익명",
      content: commentContent,
      parentId: null,
      createdAt: Timestamp.now()
    };

    try {
      setComments((previousComments: any[]) => [optimisticComment, ...previousComments]);
      setNewComment("");

      await addDoc(collection(db, "comments"), {
        appId: id,
        userId: user.uid,
        userName: profile?.nickname || user.displayName || "익명",
        content: commentContent,
        parentId: null,
        createdAt: serverTimestamp()
      });

      toast.success("댓글이 등록되었습니다.");
      setTimeout(() => fetchComments(), 1000);
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("댓글 등록에 실패했습니다.");
      setComments((previousComments: any[]) => previousComments.filter((comment) => comment.id !== optimisticComment.id));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!user) {
      toast.error("답글을 작성하려면 로그인이 필요합니다.");
      return;
    }

    const replyContent = replyComment.trim();
    if (!replyContent) return;

    setSubmittingReplyToCommentId(parentId);

    const optimisticReply = {
      id: "temp-reply-" + Date.now(),
      appId: id,
      userId: user.uid,
      userName: profile?.nickname || user.displayName || "익명",
      content: replyContent,
      parentId,
      createdAt: Timestamp.now()
    };

    try {
      setComments((previousComments: any[]) => [...previousComments, optimisticReply]);
      closeReplyComposer();

      await addDoc(collection(db, "comments"), {
        appId: id,
        userId: user.uid,
        userName: profile?.nickname || user.displayName || "익명",
        content: replyContent,
        parentId,
        createdAt: serverTimestamp()
      });

      toast.success("답글이 등록되었습니다.");
      setTimeout(() => fetchComments(), 1000);
    } catch (error) {
      console.error("Error adding reply:", error);
      toast.error("답글 등록에 실패했습니다.");
      setComments((previousComments: any[]) => previousComments.filter((comment) => comment.id !== optimisticReply.id));
    } finally {
      setSubmittingReplyToCommentId(null);
    }
  };

  const handleSaveCommentEdit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();

    const nextContent = editCommentValue.trim();
    if (!nextContent) {
      toast.error("댓글 내용을 입력해주세요.");
      return;
    }

    const previousComment = comments.find((comment) => comment.id === commentId);
    if (!previousComment) return;

    setSavingCommentId(commentId);
    closeReplyComposer();

    try {
      setComments((previousComments: any[]) =>
        previousComments.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                content: nextContent,
                editedAt: Timestamp.now()
              }
            : comment
        )
      );

      await updateDoc(doc(db, "comments", commentId), {
        content: nextContent,
        editedAt: serverTimestamp()
      });

      toast.success("댓글이 수정되었습니다.");
      closeEditComposer();
      setTimeout(() => fetchComments(), 1000);
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("댓글 수정에 실패했습니다.");
      setComments((previousComments: any[]) =>
        previousComments.map((comment) => (comment.id === commentId ? previousComment : comment))
      );
    } finally {
      setSavingCommentId(null);
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

  const isCompletedApp = isAppTestCompleted(app);
  const isAdmin = profile?.role === "admin";
  const topLevelComments = comments
    .filter((comment) => !comment.parentId)
    .sort((a, b) => getCommentTimestamp(b.createdAt) - getCommentTimestamp(a.createdAt));
  const replyGroups = comments.reduce((groups: Record<string, any[]>, comment) => {
    if (!comment.parentId) {
      return groups;
    }

    const nextGroup = groups[comment.parentId] || [];
    nextGroup.push(comment);
    groups[comment.parentId] = nextGroup.sort(
      (a, b) => getCommentTimestamp(a.createdAt) - getCommentTimestamp(b.createdAt)
    );
    return groups;
  }, {} as Record<string, any[]>);

  const renderCommentCard = (comment: any, isReply = false) => {
    const canManageComment = !!user && (comment.userId === user.uid || isAdmin);
    const isEditing = editingCommentId === comment.id;
    const isSaving = savingCommentId === comment.id;
    const contentPaddingClass = isReply ? "" : "pl-12";

    return (
      <div className={isReply ? "rounded-2xl border border-slate-100 bg-slate-50/80 p-4" : ""}>
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
              <User className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="leading-tight font-bold text-slate-900">{comment.userName}</p>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {safeFormatDate(comment.createdAt)}
                </span>
                {comment.editedAt ? <span className="font-semibold">수정됨</span> : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {user ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenReplyComposer(comment)}
                className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
              >
                답글
              </Button>
            ) : null}
            {canManageComment ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenEditComposer(comment)}
                className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
              >
                수정
              </Button>
            ) : null}
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={(e) => handleSaveCommentEdit(e, comment.id)} className={`${contentPaddingClass} mt-3 space-y-3`}>
            <Textarea
              value={editCommentValue}
              onChange={(e) => setEditCommentValue(e.target.value)}
              disabled={isSaving}
              className="min-h-[96px] resize-none rounded-2xl border-slate-200 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeEditComposer} disabled={isSaving}>
                취소
              </Button>
              <Button type="submit" disabled={!editCommentValue.trim() || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
              </Button>
            </div>
          </form>
        ) : (
          <p className={`whitespace-pre-wrap text-slate-600 leading-relaxed ${contentPaddingClass}`}>
            {comment.content}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="light-theme-readable min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <Button
          type="button"
          variant="ghost"
          onClick={handleBackNavigation}
          className="mb-4 min-h-11 px-3 touch-manipulation"
        >
          <ArrowLeft className="h-4 w-4" />
          뒤로 가기
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
                <span className="text-xs font-black uppercase">{isCompletedApp ? "테스트 완료" : "모집 중"}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Handshake className="h-4 w-4 text-primary" />
                교차 테스트 현황
              </h3>
              {checkingCrossStatus ? (
                <p className="text-sm text-slate-500">확인 중...</p>
              ) : !crossStatus?.hasMyApps ? (
                <p className="text-sm font-semibold text-slate-700">테스트 참여에 감사합니다.</p>
              ) : crossStatus.isDeveloperTestingMine ? (
                <Badge className="bg-emerald-600">해당 개발자가 내 앱을 테스트 중입니다.</Badge>
              ) : (
                <Badge variant="secondary">해당 개발자가 내 앱을 아직 테스트하지 않았습니다.</Badge>
              )}
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

              {isCompletedApp ? (
                <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-lg font-bold text-slate-800">테스트가 완료된 앱입니다.</p>
                  <p className="text-sm text-slate-500 mt-1">새 테스트를 등록하면 앱 탐색에서 다시 참여를 받을 수 있습니다.</p>
                </div>
              ) : checkingParticipation ? (
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
                      테스터 권한을 얻기 위해 먼저 구글 그룹스에 가입해주세요.<br />
                      이미 가입을 마쳤다면 2단계 버튼으로 바로 참여 링크를 활성화할 수 있습니다.
                    </p>

                    <Button
                      size="lg"
                      className="ml-11 h-14 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black shadow-xl"
                      disabled={!app.googleGroupLink}
                      onClick={openGoogleGroupLink}
                    >
                      <Users className="mr-2 h-5 w-5" />
                      구글 그룹스 열기
                    </Button>

                    {!app.googleGroupLink && (
                      <p className="text-xs text-red-500 mt-2 ml-11 font-bold">
                        * 현재 앱의 그룹스 가입 링크가 등록되지 않아 참여가 불가능합니다.
                      </p>
                    )}
                  </div>

                  <div className="p-6 rounded-2xl border bg-slate-50 border-slate-200">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-black">2</span>
                      <h4 className="font-bold text-slate-900 text-lg">참여 링크 활성화</h4>
                    </div>
                    <p className="text-sm text-slate-600 ml-11 mb-6">
                      그룹 가입 후 아래 버튼을 누르면 테스터 등록이 완료되고 참여 링크가 바로 나타납니다.
                    </p>
                    <Button
                      size="lg"
                      className="ml-11 h-14 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-black shadow-xl shadow-primary/20"
                      disabled={requesting || !app.googleGroupLink}
                      onClick={handleJoinRequest}
                    >
                      {requesting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                      가입 완료 후 참여 링크 활성화
                    </Button>
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
                <div className="py-10 text-center text-slate-400">
                  <MessageSquare className="mx-auto mb-2 h-10 w-10 opacity-20" />
                  첫 번째 피드백을 남겨보세요!
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {topLevelComments.map((comment) => (
                    <div key={comment.id} className="py-6 first:pt-0">
                      {renderCommentCard(comment)}

                      {replyingToCommentId === comment.id ? (
                        <form
                          onSubmit={(e) => handleSubmitReply(e, comment.id)}
                          className="mt-4 ml-12 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-xs font-semibold text-slate-500">
                            {replyTargetName ? `${replyTargetName}님에게 답글 작성 중` : "답글 작성 중"}
                          </p>
                          <Textarea
                            placeholder="답글을 입력해주세요."
                            value={replyComment}
                            onChange={(e) => setReplyComment(e.target.value)}
                            disabled={submittingReplyToCommentId === comment.id}
                            className="min-h-[88px] resize-none rounded-2xl border-slate-200 focus:ring-primary"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={closeReplyComposer}
                              disabled={submittingReplyToCommentId === comment.id}
                            >
                              취소
                            </Button>
                            <Button
                              type="submit"
                              disabled={!replyComment.trim() || submittingReplyToCommentId === comment.id}
                            >
                              {submittingReplyToCommentId === comment.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "답글 등록"
                              )}
                            </Button>
                          </div>
                        </form>
                      ) : null}

                      {replyGroups[comment.id]?.length ? (
                        <div className="mt-4 ml-12 space-y-3 border-l border-slate-200 pl-6">
                          {replyGroups[comment.id].map((reply) => (
                            <div key={reply.id}>{renderCommentCard(reply, true)}</div>
                          ))}
                        </div>
                      ) : null}
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
