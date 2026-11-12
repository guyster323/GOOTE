"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings,
  MousePointer2,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Info,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { OPEN_KAKAO_URL } from "@/lib/community";

const googleGroupsSteps = [
  {
    title: "Google Groups에서 그룹 만들기",
    description: "https://groups.google.com/ 에서 비공개 테스트용 새 그룹을 생성하세요.",
  },
  {
    title: "그룹스 이메일 메모",
    description: "생성 직후 표시되는 그룹 이메일 주소를 꼭 메모해두세요. 이후 Play Console과 GOOTE에서 모두 사용합니다.",
    highlight: true,
  },
  {
    title: "개인정보 보호 설정 변경",
    description: "개인정보 보호 설정에서 그룹 가입 권한을 '누구나 가입할 수 있음'으로 설정하세요. 테스터가 초대 없이 바로 가입할 수 있어야 합니다.",
    highlight: true,
  },
  {
    title: "Play Console에서 Google Groups 선택",
    description: "구글 플레이 콘솔로 돌아가 비공개 테스트 > 테스터에서 'Google 그룹스'를 선택하세요.",
  },
  {
    title: "메모한 그룹스 이메일 입력",
    description: "Play Console의 Google Groups 입력란에 아까 메모해둔 그룹 이메일을 정확히 입력하세요.",
    highlight: true,
  },
  {
    title: "Android / Web 참여 링크 메모",
    description: "테스트 참여 방법에 표시되는 Android 참여 링크와 Web 참여 링크를 각각 메모하세요.",
    highlight: true,
  },
  {
    title: "GOOTE 앱 등록하기에 3가지 값 입력",
    description: "GOOTE의 '앱등록하기'에서 그룹스 이메일, Android 참여 링크, Web 참여 링크를 그대로 입력하면 됩니다.",
  },
];

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
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">1. 개발자: Google Groups 설정 (핵심)</h2>
          </div>
          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                Play Console과 GOOTE를 오가는 실제 등록 순서
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button size="sm" className="rounded-full font-bold" asChild>
                  <a href="https://groups.google.com/" target="_blank" rel="noopener noreferrer">
                    Google Groups 열기 <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                </Button>
                <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">
                  중요: 그룹 이메일과 Android / Web 참여 링크는 반드시 메모
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {googleGroupsSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className={`rounded-3xl border p-5 ${
                      step.highlight
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                        {index + 1}
                      </div>
                      {step.highlight && (
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                          중요
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900">{step.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl bg-slate-900 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Checklist</p>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    그룹 이메일을 Play Console과 GOOTE에 동일하게 입력
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    Android / Web 참여 링크를 메모 후 GOOTE 앱 등록하기에 입력
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    가입 권한은 반드시 &apos;누구나 가입할 수 있음&apos;으로 설정
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

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
          <a href={OPEN_KAKAO_URL} target="_blank" rel="noopener noreferrer">
            오픈채팅에서 질문하기
          </a>
        </Button>
      </div>
    </div>
  );
}
