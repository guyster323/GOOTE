"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";

export default function OnboardingPage() {
  const { user, profile, updateProfile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!nickname.trim()) {
      toast.error("카카오 오픈채팅방 닉네임을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", user.uid);

      // CRITICAL FIX: Create complete user document if it doesn't exist
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || "",
        nickname: nickname.trim(),
        profileImage: user.photoURL || "",
        role: "user",
        dismissedGuides: [],
        stats: {
          appsRegistered: 0,
          testsJoined: 0,
          testsCompleted: 0,
          totalLikes: 0,
          totalConsecutiveDays: 0,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Force local update immediately
      updateProfile({ nickname: nickname.trim() });

      // CRITICAL FIX: Wait for Firestore onSnapshot to receive update before redirecting
      // This prevents the race condition where OnboardingCheck runs before profile is updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success("환영합니다! 가입이 완료되었습니다.");
      router.push("/dashboard");
    } catch (error) {
      console.error("Error updating nickname:", error);
      toast.error("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full shadow-2xl border-none">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-yellow-200">
            <MessageCircle className="text-white h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-black">추가 정보 입력</CardTitle>
          <CardDescription className="text-base">
            GOOTE 커뮤니티 활동을 위해<br />
            <strong>카카오 오픈채팅방 닉네임</strong>을 입력해주세요.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-slate-700 font-bold">카카오 오픈채팅방 닉네임</Label>
              <Input
                id="nickname"
                placeholder="오픈채팅방과 동일한 닉네임"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="h-12 border-slate-200 focus:ring-yellow-400"
                autoFocus
              />
              <p className="text-xs text-slate-500">
                * 실제 오픈채팅방에서 사용 중인 닉네임을 적어주세요.
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-2 pb-8">
            <Button
              type="submit"
              className="w-full h-12 font-black bg-slate-900 hover:bg-slate-800 shadow-xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "시작하기"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
