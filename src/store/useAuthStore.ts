import { create } from "zustand";
import { User } from "firebase/auth";

interface UserProfile {
  uid: string;
  email: string;
  nickname: string;
  profileImage: string;
  role: string;
  dismissedGuides?: string[];
  stats: {
    appsRegistered: number;
    testsJoined: number;
    testsCompleted: number;
    totalLikes: number;
    totalConsecutiveDays: number;
  };
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile, isLoading: false }),
  updateProfile: (updates) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    })),
  setIsLoading: (isLoading) => set({ isLoading }),
}));
