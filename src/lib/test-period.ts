const DAY_MS = 24 * 60 * 60 * 1000;

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && value !== null) {
    const ts = value as TimestampLike;
    if (typeof ts.toDate === "function") {
      const d = ts.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof ts.seconds === "number") {
      const millis = ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1_000_000);
      const d = new Date(millis);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY_MS);

export const getAppTestEndDate = (app: {
  createdAt?: unknown;
  testDuration?: number;
}) => {
  const createdAt = toDate(app.createdAt);
  const duration = Number(app.testDuration || 0);
  if (!createdAt || duration <= 0) return null;
  return addDays(createdAt, duration);
};

export const isAppTestCompleted = (
  app: {
    status?: string;
    createdAt?: unknown;
    testDuration?: number;
  },
  now: Date = new Date()
) => {
  if (app.status === "test-completed") return true;
  const endDate = getAppTestEndDate(app);
  if (!endDate) return false;
  return now >= endDate;
};

export const getParticipationStartDate = (participation: {
  startDate?: unknown;
  createdAt?: unknown;
}) => toDate(participation.startDate) || toDate(participation.createdAt);

export const getParticipationEndDate = (participation: {
  endDate?: unknown;
  startDate?: unknown;
  createdAt?: unknown;
  targetDays?: number;
}) => {
  const explicitEndDate = toDate(participation.endDate);
  if (explicitEndDate) return explicitEndDate;

  const startDate = getParticipationStartDate(participation);
  const targetDays = Number(participation.targetDays || 0);
  if (!startDate || targetDays <= 0) return null;
  return addDays(startDate, targetDays);
};

export const isParticipationExpired = (
  participation: {
    endDate?: unknown;
    startDate?: unknown;
    createdAt?: unknown;
    targetDays?: number;
    status?: string;
  },
  now: Date = new Date()
) => {
  if (participation.status === "completed") return true;
  const endDate = getParticipationEndDate(participation);
  if (!endDate) return false;
  return now >= endDate;
};

