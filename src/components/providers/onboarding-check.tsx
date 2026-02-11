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

    // Only redirect if everything is loaded
    if (!isLoading && user) {
      const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));
      const isOnboardingPath = pathname === "/onboarding";

      if (!isOnboardingPath && !isPublicPath) {
        // If profile is explicitly loaded and nickname is missing
        // (If profile is null even when isLoading is false, it means user doc doesn't exist yet)
        if (profile) {
          if (!profile.nickname) {
            router.push("/onboarding");
          }
        } else {
          // No profile doc found at all for this user
          router.push("/onboarding");
        }
      }
    }
  }, [user, profile, isLoading, pathname, router]);

  return <>{children}</>;
}
