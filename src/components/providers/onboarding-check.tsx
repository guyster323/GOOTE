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
        // CRITICAL FIX: Add debounce to prevent race condition
        // Wait a bit to ensure profile is fully loaded from Firestore
        const timeoutId = setTimeout(() => {
          // If profile is explicitly loaded and nickname is missing
          if (profile) {
            if (!profile.nickname || profile.nickname.trim() === "") {
              console.log("Redirecting to onboarding: nickname missing");
              router.push("/onboarding");
            }
          } else {
            // No profile doc found at all for this user
            console.log("Redirecting to onboarding: no profile document");
            router.push("/onboarding");
          }
        }, 300); // 300ms debounce to allow onSnapshot to complete

        return () => clearTimeout(timeoutId);
      }
    }
  }, [user, profile, isLoading, pathname, router]);

  return <>{children}</>;
}
