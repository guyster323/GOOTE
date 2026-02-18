"use client";

import {
  LayoutDashboard,
  AppWindow,
  Search,
  Settings,
  LogOut,
  ChevronUp,
  User2,
  CheckCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";

const navItems = [
  {
    title: "대시보드",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "참여 중인 테스트",
    url: "/my-tests",
    icon: CheckCircle,
  },
  {
    title: "내 앱 관리",
    url: "/my-apps",
    icon: AppWindow,
  },
  {
    title: "앱 둘러보기",
    url: "/explore",
    icon: Search,
  },
  {
    title: "설정",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Sidebar collapsible="icon" variant="inset" className="border-r-0 shadow-xl">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-lg shadow-primary/20">
            <AppWindow className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-lg tracking-tighter">GOOTE <span className="text-[10px] text-muted-foreground align-top ml-0.5">v0.7</span></span>
            <span className="text-[10px] text-primary font-bold leading-none uppercase tracking-tighter">Pro Max</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70">메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2">
              {navItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        transition-all duration-200 group-data-[collapsible=icon]:justify-center
                        ${isActive ? "bg-primary/10 text-primary font-semibold shadow-sm" : "hover:bg-slate-100 text-slate-600"}
                      `}
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full bg-slate-50 border shadow-sm hover:bg-slate-100 transition-colors group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shadow-inner">
                    <User2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col items-start ml-3 text-sm group-data-[collapsible=icon]:hidden">
                    <span className="font-bold text-slate-900 truncate max-w-[120px]">
                      {profile?.nickname || "닉네임 설정"}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px] font-medium">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 text-slate-400 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-56 rounded-xl shadow-2xl border-slate-200 p-1"
              >
                <DropdownMenuItem asChild className="rounded-lg py-2">
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-slate-500" />
                    <span className="font-medium">계정 설정</span>
                  </Link>
                </DropdownMenuItem>
                <Separator className="my-1" />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    router.push("/");
                  }}
                  className="rounded-lg py-2 text-red-600 focus:bg-red-50 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="font-medium">로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
