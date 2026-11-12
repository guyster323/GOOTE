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
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);

      if (user) {
        setIsLoading(true);

        const unsubscribeProfile = onSnapshot(
          doc(db, "users", user.uid),
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              const nextProfile = {
                ...data,
                role: data.role === "admin" ? "admin" : "user",
              };

              console.log("✅ Profile loaded for:", user.uid, "nickname:", data.nickname || "MISSING");
              setProfile(nextProfile as any);
            } else {
              console.log("⚠️ No profile document found for:", user.uid, "- Will create on onboarding");
              setProfile(null);
              setIsLoading(false);
            }
          },
          (error) => {
            console.error("❌ Profile subscription error:", error);
            setIsLoading(false);
          }
        );

        return () => unsubscribeProfile();
      }

      console.log("🚪 No user authenticated - clearing profile");
      setProfile(null);
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, [setUser, setProfile, setIsLoading]);

  return <>{children}</>;
}
