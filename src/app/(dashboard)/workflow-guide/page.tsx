"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings,
  MousePointer2,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Info
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";

export default function WorkflowGuidePage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit -ml-2 text-slate-500 font-bold"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          이전으로
        </Button>
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-slate-900">워크플로우 가이드</h1>
          <p className="text-muted-foreground text-lg">
            GOOTE에서 앱을 성공적으로 등록하고 20명의 테스터를 모집하는 전체 과정을 안내합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Step 1: Developer Groups Setup */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">1. 개발자: Google Group 설정 (핵심)</h2>
          </div>
          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                성공적인 모집을 위한 필수 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="font-bold text-blue-900 text-sm mb-1">가입 권한 설정</p>
                    <p className="text-sm text-blue-800/80 leading-relaxed">
                      &quot;가입할 수 있는 사용자&quot;를 <strong>웹 상의 모든 사용자</strong>로 설정하세요. 테스터가 별도의 초대 없이 즉시 참여할 수 있습니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="font-bold text-slate-900 text-sm mb-1">개인정보 보호</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      &quot;게시물 작성&quot; 및 &quot;멤버 보기&quot;를 <strong>그룹 멤버</strong>로 한정하여 보안을 유지하세요.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col justify-center">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-2">Checklist</p>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      Play Console에 그룹 이메일 등록
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      GOOTE에 그룹 가입 링크 등록
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Step 2: Tester Participation */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <MousePointer2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">2. 테스터: 앱 참여 (Opt-in)</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-primary">1</div>
              <p className="font-bold text-slate-900">앱 탐색</p>
              <p className="text-sm text-slate-500">둘러보기 메뉴에서 관심 있는 앱의 설명을 확인합니다.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/20 bg-primary/5 space-y-3">
              <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-black">2</div>
              <p className="font-bold text-slate-900 text-primary">참여하기 클릭</p>
              <p className="text-sm text-slate-600">참여하기 버튼을 누르면 구글 그룹스 및 테스트 가이드가 활성화됩니다.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-primary">3</div>
              <p className="font-bold text-slate-900">테스트 시작</p>
              <p className="text-sm text-slate-500">안내된 링크를 통해 앱을 설치하고 테스트를 진행합니다.</p>
            </div>
          </div>
        </section>

        {/* Step 3: Daily Engagement */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">3. 상호작용: 일일 참여 인증</h2>
          </div>
          <Card className="border-none shadow-lg bg-gradient-to-br from-slate-900 to-indigo-950 text-white">
            <CardContent className="p-8 md:p-10 space-y-6">
              <div className="space-y-2">
                <p className="text-indigo-400 font-black text-sm uppercase tracking-tighter">Engagement</p>
                <h3 className="text-2xl font-bold">매일 오전 9:30, 잊지 마세요!</h3>
              </div>
              <p className="text-slate-300 leading-relaxed max-w-2xl">
                GOOTE 시스템이 발송하는 데일리 알림 메일의 <strong>[실행하기]</strong> 버튼을 클릭하면
                해당 앱의 상세 페이지로 연결되며, 자동으로 그날의 참여 카운트가 올라갑니다.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-xs font-bold">참여 현황 실시간 업데이트</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-xs font-bold">14일 유지 조건 달성 지원</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Separator className="bg-slate-200/60" />

      <div className="flex flex-col items-center gap-6 py-10">
        <h3 className="text-xl font-bold text-slate-900">궁금한 점이 더 있으신가요?</h3>
        <Button size="lg" className="rounded-full px-8 font-black shadow-xl" asChild>
          <a href="https://open.kakao.com/o/ghJ9350f" target="_blank" rel="noopener noreferrer">
            오픈채팅에서 질문하기
          </a>
        </Button>
      </div>
    </div>
  );
}
