"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpCircle, Globe, Users, ExternalLink } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "앱 이름은 필수입니다"),
  androidParticipationLink: z.string().url("올바른 URL 형식이 아닙니다").refine((value) => value.startsWith("https://"), "https 링크만 허용됩니다"),
  webParticipationLink: z.string().url("올바른 URL 형식이 아닙니다").refine((value) => value.startsWith("https://"), "https 링크만 허용됩니다"),
  googleGroupEmail: z.string().email("올바른 이메일 형식이 아닙니다"),
  googleGroupLink: z.string().url("올바른 URL 형식이 아닙니다").refine((value) => value.startsWith("https://"), "https 링크만 허용됩니다"),
  packageName: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, "패키지 이름 형식이 올바르지 않습니다 (예: com.example.app)"),
  developerConsoleId: z.string().regex(/^$|^[0-9]+$/, "Play Console 개발자 ID는 숫자만 입력하세요").optional(),
  description: z.string().max(2000, "설명은 2000자 이하여야 합니다").optional(),
  mailTemplate: z.string().max(4000, "템플릿은 4000자 이하여야 합니다").optional(),
  category: z.enum(["game", "utility", "productivity", "other"]),
  testDuration: z.number().min(7, "테스트 기간은 7일 이상이어야 합니다").max(30, "테스트 기간은 30일 이하여야 합니다"),
  minTesters: z.number().min(1, "최소 1명 이상의 테스터가 필요합니다").max(100, "최대 100명까지 설정 가능합니다"),
  dismissGuide: z.boolean(),
});

const registrationWorkflowSteps = [
  {
    title: "Google Groups에서 그룹 만들기 진행",
    description: "https://groups.google.com/ 에서 비공개 테스트용 새 그룹을 만드세요.",
  },
  {
    title: "그룹스 이메일 메모",
    description: "생성된 그룹 이메일 주소를 꼭 메모하세요. 이후 Play Console과 GOOTE에서 모두 사용합니다.",
    important: true,
  },
  {
    title: "가입 권한을 '누구나 가입할 수 있음'으로 설정",
    description: "개인정보 보호 설정에서 그룹 가입 권한을 변경해야 테스터가 바로 들어올 수 있습니다.",
    important: true,
  },
  {
    title: "Play Console에서 'Google 그룹스' 선택",
    description: "비공개 테스트 > 테스터로 이동한 뒤 테스터 유형에서 'Google 그룹스'를 선택하세요.",
  },
  {
    title: "메모한 그룹스 이메일 기입",
    description: "Play Console에 아까 메모한 그룹스 이메일을 정확히 입력하세요.",
    important: true,
  },
  {
    title: "Android / Web 참여 링크 메모",
    description: "테스트 참여 방법에 표시되는 Android 참여 링크와 Web 참여 링크를 각각 메모하세요.",
    important: true,
  },
  {
    title: "GOOTE 앱등록하기에 값 입력",
    description: "메모해둔 그룹스 이메일, Android 참여 링크, Web 참여 링크를 아래 입력란에 그대로 넣으면 됩니다.",
  },
];

export default function RegisterAppPage() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      toast.error("로그인이 필요한 페이지입니다.");
      router.push("/?mode=login");
    }
  }, [user, isLoading, router]);

  const isGuideDismissed = profile?.dismissedGuides?.includes("google-group-setup");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      androidParticipationLink: "",
      webParticipationLink: "",
      googleGroupEmail: "",
      googleGroupLink: "",
      packageName: "",
      developerConsoleId: "",
      description: "",
      mailTemplate: "",
      category: "utility",
      testDuration: 14,
      minTesters: 20,
      dismissGuide: false,
    },
  });

  const dismissGuide = useWatch({
    control: form.control,
    name: "dismissGuide",
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast.error("로그인이 필요한 서비스입니다");
      return;
    }

    try {
      const { dismissGuide, ...appData } = values;

      const createApp = httpsCallable(functions, "createApp");
      await createApp(appData);

      if (dismissGuide) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          dismissedGuides: arrayUnion("google-group-setup")
        });
      }

      toast.success("앱이 성공적으로 등록되었습니다!");
      router.push("/my-apps");
    } catch (error) {
      console.error("Error registering app:", error);
      toast.error("앱 등록에 실패했습니다. 다시 시도해주세요.");
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 md:px-0">
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-slate-900">신규 앱 등록</h1>
        <p className="text-muted-foreground text-lg">
          테스터 모집을 위한 앱 상세 정보를 입력해주세요.
        </p>
      </div>

      {!isGuideDismissed && (
        <div className="mb-8 bg-blue-50 border border-blue-100 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-blue-900">Google Groups 워크플로우 안내</h2>
              <p className="text-blue-700/80 font-medium">비공개 테스트 등록 전에 그룹 이메일과 Android / Web 참여 링크를 먼저 메모하세요.</p>
            </div>
            <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-100 font-bold" asChild>
              <Link href="/workflow-guide" className="flex items-center gap-1">
                전체 가이드 보기 <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            등록 전에 메모할 값: 그룹스 이메일, Android 참여 링크, Web 참여 링크
          </div>

          <div className="space-y-4">
            {registrationWorkflowSteps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-black text-sm">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-blue-900">{step.title}</p>
                    {step.important && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 border border-amber-200">
                        중요
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-blue-800/70">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center space-x-2 border-t border-blue-100">
            <Checkbox
              id="dismiss-guide"
              checked={dismissGuide}
              onCheckedChange={(checked) => form.setValue("dismissGuide", !!checked)}
            />
            <label
              htmlFor="dismiss-guide"
              className="text-sm font-medium leading-none text-blue-800 cursor-pointer"
            >
              이 가이드를 다시 보지 않기
            </label>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-bold">앱 이름</FormLabel>
                <FormControl>
                  <Input placeholder="내 멋진 앱 이름" {...field} className="h-12 border-slate-200" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <h3 className="text-lg font-black flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Google Groups 정보
            </h3>

            <FormField
              control={form.control}
              name="googleGroupEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-bold">구글 그룹 이메일</FormLabel>
                  <FormControl>
                    <Input placeholder="your-app-testers@googlegroups.com" {...field} className="h-12 border-slate-200 bg-white" />
                  </FormControl>
                  <FormDescription>Google Groups에서 메모해둔 그룹 이메일을 입력하세요.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="googleGroupLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-bold">구글 그룹 가입 링크</FormLabel>
                  <FormControl>
                    <Input placeholder="https://groups.google.com/g/your-app-testers" {...field} className="h-12 border-slate-200 bg-white" />
                  </FormControl>
                  <FormDescription>테스터가 그룹에 가입할 Google Groups 링크를 입력하세요.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="androidParticipationLink"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2 mb-1">
                  <FormLabel className="text-slate-700 font-bold">Android 테스트 참여 링크</FormLabel>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button type="button" className="inline-flex items-center justify-center rounded-full h-5 w-5 bg-slate-100 text-slate-500 hover:bg-primary/10 hover:text-primary transition-all">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                          <Globe className="h-5 w-5 text-primary" />
                          구글 플레이 테스트 링크 찾기
                        </DialogTitle>
                        <DialogDescription className="text-base">
                          Play Console에서 아래 순서대로 진행하면 됩니다.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 py-6">
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-sm">1</div>
                          <div className="space-y-1">
                            <p className="font-bold leading-none">비공개 테스트 &gt; 테스터로 이동</p>
                            <p className="text-sm text-muted-foreground">구글 플레이 콘솔에서 앱을 선택한 뒤 &apos;비공개 테스트&apos;의 &apos;테스터&apos; 화면으로 이동하세요.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-sm">2</div>
                          <div className="space-y-1">
                            <p className="font-bold leading-none">테스터 유형에서 Google 그룹스 선택</p>
                            <p className="text-sm text-muted-foreground">테스터 추가 방식으로 &apos;Google 그룹스&apos;를 선택하고 그룹 이메일을 입력하세요.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-sm">3</div>
                          <div className="space-y-1">
                            <p className="font-bold leading-none">그룹 이메일 저장</p>
                            <p className="text-sm text-muted-foreground">앞에서 메모한 그룹스 이메일을 정확히 넣어야 참여 링크가 정상 동작합니다.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-sm">4</div>
                          <div className="space-y-1">
                            <p className="font-bold leading-none">Android / Web 참여 링크 복사</p>
                            <p className="text-sm text-muted-foreground">테스트 참여 방법에 표시되는 Android 참여 링크와 Web 참여 링크를 각각 메모해 아래 입력란에 붙여넣으세요.</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          * 비공개 테스트는 Google Groups와 참여 링크 2개를 모두 준비해둔 뒤 등록하는 것이 가장 안전합니다.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <FormControl>
                  <Input placeholder="https://play.google.com/apps/testing/..." {...field} className="h-12 border-slate-200" />
                </FormControl>
                <FormDescription>
                  Play Console에서 메모한 Android 참여 링크를 입력하세요.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="webParticipationLink"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-bold">Web 테스트 참여 링크</FormLabel>
                <FormControl>
                  <Input placeholder="https://play.google.com/apps/testing/..." {...field} className="h-12 border-slate-200" />
                </FormControl>
                <FormDescription>
                  Play Console에서 메모한 Web 참여 링크를 입력하세요.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="packageName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-bold">패키지 이름</FormLabel>
                <FormControl>
                  <Input placeholder="com.example.myapp" {...field} className="h-12 border-slate-200" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="developerConsoleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-bold">Play Console 개발자 ID (선택)</FormLabel>
                <FormControl>
                  <Input placeholder="12345678901234567890" {...field} className="h-12 border-slate-200" inputMode="numeric" />
                </FormControl>
                <FormDescription>승인 메일에서 Play Console 내부 테스트 화면으로 바로 이동시키려면 입력하세요.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-bold">카테고리</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12 border-slate-200 bg-white">
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white text-slate-900">
                    <SelectItem value="game">게임</SelectItem>
                    <SelectItem value="utility">유틸리티</SelectItem>
                    <SelectItem value="productivity">생산성</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-bold">앱 설명 (선택)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="앱에 대한 간단한 소개와 테스터들에게 요청하고 싶은 사항을 적어주세요."
                    className="resize-none min-h-[120px] border-slate-200 focus:ring-primary"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mailTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-bold">커스텀 메일 템플릿 (선택)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="일일 체크인 알림 메일 본문을 커스터마이징하고 싶다면 작성해주세요. 미입력 시 기본 템플릿이 사용됩니다."
                    className="resize-y min-h-[160px] border-slate-200 focus:ring-primary font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  <div className="mt-2 bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2 text-slate-600">
                    <p className="text-xs font-bold text-slate-700">본문은 일반 텍스트로 전달됩니다. HTML은 실행되지 않습니다.</p>
                    <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
                      <li><code>{"{testerNickname}"}</code> : 테스터의 닉네임</li>
                      <li><code>{"{appName}"}</code> : 등록된 앱 이름</li>
                      <li><code>{"{trackLinkAndroid}"}</code> : Android 인증 링크 텍스트</li>
                      <li><code>{"{trackLinkWeb}"}</code> : Web 인증 링크 텍스트</li>
                    </ul>
                    <p className="text-[11px] text-amber-600 font-medium">* Android/Web 공식 인증 버튼은 템플릿에 치환자를 넣지 않아도 메일에 항상 포함됩니다. 링크 치환자는 본문에 주소 텍스트를 보여줄 때만 필요합니다.</p>
                  </div>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <FormField
              control={form.control}
              name="testDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-bold">테스트 기간 (일)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={7}
                      max={30}
                      placeholder="14"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className="h-12 border-slate-200"
                    />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    테스터들이 앱을 유지해야 하는 최소 기간입니다. (7-30일)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="minTesters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-bold">목표 테스터 수 (명)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="20"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className="h-12 border-slate-200"
                    />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    모집하고자 하는 최소 테스터 인원입니다. (1-100명)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              className="h-12 px-8 font-bold text-slate-500"
            >
              취소
            </Button>
            <Button type="submit" className="h-12 px-10 font-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
              앱 등록 완료
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
