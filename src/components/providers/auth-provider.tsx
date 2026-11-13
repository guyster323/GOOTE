"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setUser = useAuthStore((state) => state.setUser);
  const setProfile = useAuthStore((state) => state.setProfile);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      setUser(user);

      if (!user) {
        console.log("🚪 No user authenticated - clearing profile");
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const activeUid = user.uid;
      unsubscribeProfile = onSnapshot(
        doc(db, "users", activeUid),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const nextProfile = {
              ...data,
              uid: activeUid,
              role: data.role === "admin" ? "admin" : "user",
            };

            console.log("✅ Profile loaded for:", activeUid, "nickname:", data.nickname || "MISSING");
            setProfile(nextProfile as any);
            return;
          }
          console.log("⚠️ No profile document found for:", activeUid, "- Will create on onboarding");
          setProfile(null);
          setIsLoading(false);
        },
        (error) => {
          console.error("❌ Profile subscription error:", error);
          setIsLoading(false);
        }
      );
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, [setUser, setProfile, setIsLoading]);

  return <>{children}</>;
}
