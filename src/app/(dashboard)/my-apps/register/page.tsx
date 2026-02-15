"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { HelpCircle, Globe, Users, Info, ExternalLink } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "앱 이름은 필수입니다"),
  androidParticipationLink: z.string().url("올바른 URL 형식이 아닙니다"),
  webParticipationLink: z.string().url("올바른 URL 형식이 아닙니다"),
  googleGroupEmail: z.string().email("올바른 이메일 형식이 아닙니다"),
  googleGroupLink: z.string().url("올바른 URL 형식이 아닙니다"),
  packageName: z.string().min(1, "패키지 이름은 필수입니다 (예: com.example.app)"),
  description: z.string().optional(),
  category: z.enum(["game", "utility", "productivity", "other"]),
  testDuration: z.number().min(7, "테스트 기간은 7일 이상이어야 합니다").max(30, "테스트 기간은 30일 이하여야 합니다"),
  minTesters: z.number().min(1, "최소 1명 이상의 테스터가 필요합니다").max(100, "최대 100명까지 설정 가능합니다"),
  dismissGuide: z.boolean(),
});

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
      description: "",
      category: "utility",
      testDuration: 14,
      minTesters: 20,
      dismissGuide: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast.error("로그인이 필요한 서비스입니다");
      return;
    }

    try {
      const { dismissGuide, ...appData } = values;

      await addDoc(collection(db, "apps"), {
        ...appData,
        developerId: user.uid,
        developerNickname: profile?.nickname || user.displayName || user.email,
        status: "recruiting",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        stats: {
          likes: 0,
          participants: 0,
          completedTesters: 0,
        },
      });

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
              <h2 className="text-xl font-black text-blue-900">Google Group 설정 가이드</h2>
              <p className="text-blue-700/80 font-medium">Android 비공개 테스트를 위해 꼭 필요합니다.</p>
            </div>
            <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-100 font-bold" asChild>
              <Link href="/workflow-guide" className="flex items-center gap-1">
                전체 가이드 보기 <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-black text-sm">1</div>
              <div className="space-y-1">
                <p className="font-bold text-blue-900">Google Groups 그룹 생성</p>
                <p className="text-sm text-blue-800/70">groups.google.com에서 비공개 테스트용 새 그룹을 만드세요.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-black text-sm">2</div>
              <div className="space-y-1">
                <p className="font-bold text-blue-900">가입할 수 있는 사용자 설정</p>
                <p className="text-sm text-blue-800/70">&apos;웹 상의 모든 사용자&apos;로 설정하여 테스터들이 자유롭게 가입할 수 있도록 하세요.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-black text-sm">3</div>
              <div className="space-y-1">
                <p className="font-bold text-blue-900">권한 설정</p>
                <p className="text-sm text-blue-800/70">&apos;게시물 작성&apos; 및 &apos;멤버 보기&apos; 권한을 &apos;그룹 멤버&apos;로 설정하여 개인정보를 보호하세요.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-black text-sm">4</div>
              <div className="space-y-1">
                <p className="font-bold text-blue-900">Play Console 테스터 등록</p>
                <p className="text-sm text-blue-800/70">생성한 그룹 이메일을 Play Console의 비공개 테스트 테스터 목록에 추가하세요.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center space-x-2 border-t border-blue-100">
            <Checkbox
              id="dismiss-guide"
              checked={form.watch("dismissGuide")}
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
              Google Group 정보
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
                  <FormDescription>테스터들이 가입할 구글 그룹 이메일 주소입니다.</FormDescription>
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
                  <FormDescription>테스터들이 그룹에 가입할 수 있는 링크입니다.</FormDescription>
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
                          아래 3단계를 따라 링크를 복사해오세요.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 py-6">
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-sm">1</div>
                          <div className="space-y-1">
                            <p className="font-bold leading-none">Play Console 접속</p>
                            <p className="text-sm text-muted-foreground">앱을 선택하고 &apos;내부 테스트&apos; 또는 &apos;비공개 테스트&apos; 메뉴로 이동하세요.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-sm">2</div>
                          <div className="space-y-1">
                            <p className="font-bold leading-none">테스터 탭 선택</p>
                            <p className="text-sm text-muted-foreground">&apos;테스터&apos; 탭을 클릭하고 테스터 목록과 릴리스가 활성화되어 있는지 확인하세요.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-sm">3</div>
                          <div className="space-y-1">
                            <p className="font-bold leading-none">URL 복사</p>
                            <p className="text-sm text-muted-foreground">하단의 &apos;웹 참여 링크&apos; 또는 &apos;Android 참여 링크&apos; 주소를 복사하여 붙여넣으세요.</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          * 비공개 테스트의 경우 테스터 이메일 그룹이 등록되어 있어야 링크가 정상 작동합니다.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <FormControl>
                  <Input placeholder="https://play.google.com/apps/testing/..." {...field} className="h-12 border-slate-200" />
                </FormControl>
                <FormDescription>
                  Android 앱용 Opt-in 링크를 입력하세요.
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
                  Web용 Opt-in 링크를 입력하세요.
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
