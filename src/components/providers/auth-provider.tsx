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
        // Force loading state until profile is fully fetched
        setIsLoading(true);

        const unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log("✅ Profile loaded for:", user.uid, "nickname:", data.nickname || "MISSING");
            setProfile(data as any);
          } else {
            console.log("⚠️ No profile document found for:", user.uid, "- Will create on onboarding");
            setProfile(null);
            setIsLoading(false); // Only set loading false if no doc exists
          }
        }, (error) => {
          console.error("❌ Profile subscription error:", error);
          setIsLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        console.log("🚪 No user authenticated - clearing profile");
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [setUser, setProfile, setIsLoading]);

  return <>{children}</>;
}
