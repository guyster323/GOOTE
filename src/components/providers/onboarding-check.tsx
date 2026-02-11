"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";

const PUBLIC_PATHS = ["/apps"];

export default function OnboardingCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));
    const isOnboardingPath = pathname === "/onboarding";

    if (user && !profile?.nickname && !isOnboardingPath && !isPublicPath) {
      router.push("/onboarding");
    }
  }, [user, profile, isLoading, pathname, router]);

  return <>{children}</>;
}
