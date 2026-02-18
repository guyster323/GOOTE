import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type DailyTrackType = "android" | "web";

export async function createDailyTrackUrl(participationId: string, type: DailyTrackType) {
  const createLink = httpsCallable(functions, "createDailyTrackLink");
  const result = await createLink({ participationId, type });
  const data = result.data as { url?: string };

  if (!data?.url) {
    throw new Error("Daily tracking link 생성에 실패했습니다.");
  }

  return data.url;
}
