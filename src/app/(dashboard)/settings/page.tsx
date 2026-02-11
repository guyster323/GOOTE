"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { user, profile, isLoading } = useAuth();
  const [nickname, setNickname] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (profile?.nickname) {
      setNickname(profile.nickname);
    }
  }, [profile]);

  const handleUpdateNickname = async () => {
    if (!user) return;
    if (!nickname.trim()) {
      toast.error("닉네임을 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        nickname: nickname.trim(),
        updatedAt: new Date(),
      });
      toast.success("프로필이 성공적으로 업데이트되었습니다!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("프로필 업데이트에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 lg:text-5xl">설정</h1>
        <p className="text-xl text-muted-foreground mt-2">
          계정 설정 및 개인 환경설정을 관리하세요.
        </p>
      </div>

      <Separator />

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <h2 className="text-xl font-semibold">프로필 정보</h2>
          <p className="text-sm text-muted-foreground mt-1">
            커뮤니티에서 다른 사람들에게 보여지는 모습입니다.
          </p>
        </div>

        <Card className="md:col-span-2 border-none shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>카카오 오픈채팅방 닉네임</CardTitle>
            <CardDescription>
              다른 사용자들이 알아볼 수 있도록 <strong>오픈카톡 닉네임</strong>을 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">오픈카톡 닉네임</Label>
              <div className="flex gap-2">
                <Input
                  id="nickname"
                  placeholder="오픈카톡방과 동일한 닉네임"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="max-w-md"
                />
                <Button onClick={handleUpdateNickname} disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  저장
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <h2 className="text-xl font-semibold">계정 정보</h2>
          <p className="text-sm text-muted-foreground mt-1">
            비공개 계정 정보입니다.
          </p>
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card className="border-none shadow-sm bg-muted/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">이메일 주소</p>
                <p className="font-semibold">{user?.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-muted/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">역할</p>
                <p className="font-semibold capitalize">{profile?.role === "admin" ? "관리자" : "사용자"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <h2 className="text-xl font-semibold">알림 설정</h2>
          <p className="text-sm text-muted-foreground mt-1">
            업데이트 수신 방법을 설정하세요.
          </p>
        </div>

        <Card className="md:col-span-2 border-none shadow-md bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">이메일 알림</CardTitle>
                <CardDescription>
                  일일 리마인더 및 업데이트 소식을 이메일로 받습니다.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">준비 중</Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
