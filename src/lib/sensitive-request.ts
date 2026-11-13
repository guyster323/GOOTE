export type SensitivePublication<T> = {
  generation: number;
  identityKey: string;
  rows: T[];
};

export const startSensitiveGeneration = (current: number): number => current + 1;

export const publishIfCurrent = <T>(
  currentGeneration: number,
  currentIdentity: string,
  publication: SensitivePublication<T>,
): T[] | null => {
  if (publication.generation !== currentGeneration || publication.identityKey !== currentIdentity) {
    return null;
  }
  return publication.rows;
};

export const removeSensitiveRow = <T extends { id: string }>(rows: T[], id: string): T[] =>
  rows.filter((row) => row.id !== id);

export const canRemoveMember = (
  actorId: string | undefined,
  member: { id: string; role: string },
): boolean => Boolean(actorId) && actorId !== member.id && member.role !== "admin";

export type BoundRows<T> = {
  identityKey: string;
  rows: T[];
};

export const emptyBoundRows = <T>(): BoundRows<T> => ({ identityKey: "", rows: [] });

export const visibleBoundRows = <T>(bound: BoundRows<T> | null | undefined, currentIdentity: string): T[] => {
  if (!bound || bound.identityKey !== currentIdentity) return [];
  return bound.rows;
};

export const publishBoundRows = <T>(
  currentGeneration: number,
  currentIdentity: string,
  publication: SensitivePublication<T>,
): BoundRows<T> | null => {
  const rows = publishIfCurrent(currentGeneration, currentIdentity, publication);
  if (!rows) return null;
  return { identityKey: publication.identityKey, rows };
};

export const removeBoundRow = <T extends { id: string }>(
  bound: BoundRows<T>,
  id: string,
  identityKey: string,
): BoundRows<T> => {
  if (bound.identityKey !== identityKey) return bound;
  return { identityKey, rows: removeSensitiveRow(bound.rows, id) };
};

export const viewerIdentityKey = (input: {
  uid?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  role?: string | null;
  scope?: string | null;
}): string => [
  input.uid || "",
  input.email || "",
  input.emailVerified ? "verified" : "unverified",
  input.role || "",
  input.scope || "",
].join("|");
