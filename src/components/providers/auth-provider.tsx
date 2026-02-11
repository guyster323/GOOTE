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
        setIsLoading(true); // Ensure loading is true while fetching profile
        // Subscribe to Firestore user document
        const unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as any);
          } else {
            setProfile(null);
            setIsLoading(false);
          }
        }, (error) => {
          console.error("Profile subscription error:", error);
          setIsLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [setUser, setProfile, setIsLoading]);

  return <>{children}</>;
}
