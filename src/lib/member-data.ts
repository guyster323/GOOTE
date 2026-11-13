import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type MemberDirectoryEntry = {
  id: string;
  uid: string;
  nickname: string;
  profileImage: string;
  role: string;
  email: string | null;
  stats: {
    appsRegistered: number;
    testsJoined: number;
    testsCompleted: number;
  };
};

export type PublicProfile = {
  id: string;
  uid: string;
  nickname: string;
  profileImage: string;
  stats: {
    testsJoined: number;
    testsCompleted: number;
    totalConsecutiveDays: number;
  };
};

export type AppParticipant = {
  id: string;
  testerId: string;
  status: string;
  consecutiveDays: number;
  targetDays: number;
  lastCheckIn: string;
  createdAt: number | null;
  updatedAt: number | null;
  nickname: string;
  email: string | null;
};

export const fetchMemberDirectory = async (): Promise<MemberDirectoryEntry[]> => {
  const callable = httpsCallable<unknown, { members: MemberDirectoryEntry[] }>(functions, "getMemberDirectory");
  const result = await callable();
  return result.data.members || [];
};

export const fetchPublicProfiles = async (): Promise<PublicProfile[]> => {
  const callable = httpsCallable<unknown, { profiles: PublicProfile[] }>(functions, "getPublicProfiles");
  const result = await callable();
  return result.data.profiles || [];
};

export const fetchAppParticipants = async (appId: string): Promise<AppParticipant[]> => {
  const callable = httpsCallable<{ appId: string }, { participants: AppParticipant[] }>(functions, "getAppParticipants");
  const result = await callable({ appId });
  return result.data.participants || [];
};

export const fetchOwnAppTesterIds = async (
  appIds: string[],
  statuses: string[] = ["active", "completed"]
): Promise<Set<string>> => {
  const testerIds = new Set<string>();
  for (const appIdChunk of chunk(appIds, 3)) {
    const results = await Promise.all(appIdChunk.map(async (appId) => {
      try {
        return await fetchAppParticipants(appId);
      } catch (error) {
        console.error("Error loading app participants for cross-check:", error);
        return [];
      }
    }));
    results.flat().forEach((participant) => {
      if (participant.testerId && statuses.includes(participant.status)) testerIds.add(participant.testerId);
    });
  }
  return testerIds;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};
