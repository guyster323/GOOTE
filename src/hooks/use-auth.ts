import { useAuthStore } from "@/store/useAuthStore";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const useAuth = () => {
  const { user, profile, isLoading, setUser, setIsLoading, updateProfile: updateStoreProfile } = useAuthStore();

  const dismissGuide = async (guideId: string) => {
    if (!user) return;

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        dismissedGuides: arrayUnion(guideId),
      });

      // Update local state
      const currentDismissed = profile?.dismissedGuides || [];
      if (!currentDismissed.includes(guideId)) {
        updateStoreProfile({
          dismissedGuides: [...currentDismissed, guideId],
        });
      }
    } catch (error) {
      console.error("Error dismissing guide:", error);
      throw error;
    }
  };

  return {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    setUser,
    setIsLoading,
    dismissGuide,
    updateProfile: updateStoreProfile,
  };
};
