"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";

const PUBLIC_PATH_PREFIXES = ["/apps"];
const PUBLIC_PATHS = ["/"];

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

    const isPublicPath =
      PUBLIC_PATHS.includes(pathname) ||
      PUBLIC_PATH_PREFIXES.some((path) => pathname.startsWith(path));
    const isOnboardingPath = pathname === "/onboarding";

    if (!user && !isPublicPath) {
      router.push(`/?mode=login&redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user) {
      if (isOnboardingPath || isPublicPath) return;

      // Wait briefly so the profile subscription can settle before onboarding check.
      const timeoutId = setTimeout(() => {
        if (profile) {
          if (!profile.nickname || profile.nickname.trim() === "") {
            console.log("Redirecting to onboarding: nickname missing");
            router.push("/onboarding");
          }
        } else {
          console.log("Redirecting to onboarding: no profile document");
          router.push("/onboarding");
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [user, profile, isLoading, pathname, router]);

  return <>{children}</>;
}

