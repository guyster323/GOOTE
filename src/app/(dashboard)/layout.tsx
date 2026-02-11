import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Separator } from "@/components/ui/separator";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b bg-white/80 backdrop-blur-md saturate-150 sticky top-0 z-40 px-4 md:px-8">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-1 text-slate-600 hover:text-primary hover:bg-primary/10 transition-all" />
            <Separator orientation="vertical" className="h-4 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-slate-900">GOOTE</span>
              <span className="text-[10px] text-primary font-bold leading-none uppercase tracking-tighter">Pro Max</span>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 lg:p-12 pt-4 bg-slate-50/30">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
