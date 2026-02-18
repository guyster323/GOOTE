export type DailyTrackType = "android" | "web";

export function buildDailyTrackUrl(participationId: string, type: DailyTrackType) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "goote-f48d8";
  const encodedPid = encodeURIComponent(participationId);
  return `https://us-central1-${projectId}.cloudfunctions.net/api/track-daily?pid=${encodedPid}&type=${type}`;
}
