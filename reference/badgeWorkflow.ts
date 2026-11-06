import { createHash } from "node:crypto";
import {validatePortraitPreparation,portraitPreparationIdentity, type PortraitPreparation} from "./badgePortraitGeometry.ts";

/** Domain rules only. Callers must authorize the request and resolve these
 * records from trusted storage. Never deserialize SourceRecord from a browser.
 * This module grants no Blob access and does not replace Stage 2 read rules. */
export type BadgeSourceKind = "stage2_id" | "headshot";
export type BadgeProfile = { employeeId: string; firstName: string; lastName: string };
export type SourceRecord = {
  employeeId: string;
  sourceId: string;
  kind: BadgeSourceKind;
  current: boolean;
  canRead: boolean;
  scanState: "pending" | "clean" | "unavailable";
  contentType: string;
  byteLength: number;
  width: number;
  height: number;
  /** width/height describe orientation-normalized presentation. Hashes describe
   * the untouched immutable source Blob bytes that were actually scanned.
   * The crop decoder must apply the same orientation without rewriting the ID.
   * Derived portraits have their own hashes and scan lineage. */
  sha256: string;
  scanSha256: string;
  etag: string;
  versionId: string;
  packetDocumentId?: string;
};
export type BoundSource = Pick<SourceRecord, "employeeId" | "sourceId" | "kind" |
  "sha256" | "etag" | "versionId" | "width" | "height" | "packetDocumentId">;
export type SourceReadiness =
  | { state: "denied" | "missing" | "conflict" | "processing" | "unavailable" }
  | { state: "ready"; source: BoundSource };
export type PortraitCrop = { x: number; y: number; width: number; height: number; preparation?: PortraitPreparation };
/** Server-read artifact metadata. A provider response is not a clean-file verdict. */
type PortraitArtifact = { employeeId: string; sha256: string; inputFingerprint: string;
  canRead: boolean; scanState: "pending" | "clean" | "unavailable"; scanSha256: string };
export type SelectedPortrait = PortraitArtifact & (
  | { kind: "original" }
  | { kind: "cleaned"; operationId: string; modelRevision: string; promptRevision: string });
export type BadgeReviewInput = {
  profile: BadgeProfile;
  draftId: string;
  draftRevision: number;
  source: BoundSource;
  crop: PortraitCrop;
  portrait: SelectedPortrait;
  title: string;
  templateRevision: string;
  logoSha256: string;
  fontRevision: string;
  printProfileRevision: string;
};

const hashPattern = /^[a-f0-9]{64}$/i;
const maxSourceBytes = 5 * 1024 * 1024;
const maxSourcePixels = 20_000_000;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isText = (value: string) => typeof value === "string" && value.trim().length > 0;

export function canManageEmployeeBadges(roles: readonly string[]): boolean {
  return roles.includes("Platform.Admin") || roles.includes("Platform.HR");
}

/** An ID failure does not prevent a separately authorized headshot selection. */
export function resolveBadgeSource(employeeId: string, kind: BadgeSourceKind,
  roles: readonly string[], records: readonly SourceRecord[]): SourceReadiness {
  if (!canManageEmployeeBadges(roles)) return { state: "denied" };
  if (!isText(employeeId) || !["stage2_id", "headshot"].includes(kind)) return { state: "unavailable" };
  // The database adapter must supply only this employee's authorized candidates.
  if (records.some(row => row.employeeId !== employeeId)) return { state: "conflict" };
  const current = records.filter(row => row.current && row.kind === kind);
  if (!current.length) return { state: "missing" };
  if (current.length !== 1) return { state: "conflict" };
  const row = current[0];
  if (!row.canRead) return { state: "unavailable" };
  if (row.scanState === "pending") return { state: "processing" };
  if (row.scanState !== "clean" || !hashPattern.test(row.sha256)
    || row.sha256.toLowerCase() !== row.scanSha256.toLowerCase()
    || !["image/jpeg", "image/png"].includes(row.contentType)
    || !Number.isSafeInteger(row.byteLength) || row.byteLength < 1 || row.byteLength > maxSourceBytes
    || !Number.isSafeInteger(row.width) || !Number.isSafeInteger(row.height)
    || row.width < 1 || row.height < 1 || row.width * row.height > maxSourcePixels
    || !isText(row.sourceId) || !isText(row.etag) || !isText(row.versionId)
    || (kind === "stage2_id" && !isText(row.packetDocumentId ?? ""))) return { state: "unavailable" };
  return { state: "ready", source: { employeeId, sourceId: row.sourceId, kind,
    sha256: row.sha256.toLowerCase(), etag: row.etag, versionId: row.versionId,
    width: row.width, height: row.height,
    ...(kind === "stage2_id" ? { packetDocumentId: row.packetDocumentId } : {}) } };
}

export function badgeProfileName(profile: BadgeProfile): string {
  if (!isText(profile.employeeId) || !isText(profile.firstName) || !isText(profile.lastName)) {
    throw new Error("Correct the employee's profile name before creating a badge.");
  }
  return `${profile.firstName.trim()} ${profile.lastName.trim()}`;
}

export function validatePortraitCrop(crop: PortraitCrop): void {
  const values = [crop.x, crop.y, crop.width, crop.height];
  if (!values.every(Number.isFinite) || crop.x < 0 || crop.y < 0
    || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 1
    || crop.y + crop.height > 1) throw new Error("Choose a crop within the photo.");
  if (crop.preparation !== undefined) validatePortraitPreparation(crop.preparation);
}

/** Pure identity of the source/crop sent to cleanup. Contains no name or title.
 * The later byte adapter must actually crop/strip metadata before transmission. */
export function portraitInputFingerprint(source: BoundSource, crop: PortraitCrop): string {
  validatePortraitCrop(crop);
  const identity = ["badge-portrait-v1", source.employeeId, source.sourceId, source.kind,
    source.sha256, source.etag, source.versionId, source.packetDocumentId ?? null,
    source.width, source.height, crop.x, crop.y, crop.width, crop.height];
  // Preserve existing sources, receipts and issued versions exactly. New geometry
  // is explicitly versioned and cannot reuse an older crop's approval.
  return digest(crop.preparation ? [...identity, portraitPreparationIdentity(crop.preparation)] : identity);
}

/** Call only with a newly resolved source and current server-read profile.
 * The later renderer must populate name from this snapshot, never a form field. */
export function badgeReviewFingerprint(input: BadgeReviewInput): string {
  const name = badgeProfileName(input.profile);
  if (input.profile.employeeId !== input.source.employeeId) throw new Error("The badge source belongs to another employee.");
  if (!Number.isSafeInteger(input.draftRevision) || input.draftRevision < 1
    || ![input.draftId, input.title, input.templateRevision, input.fontRevision,
      input.printProfileRevision].every(isText)
    || !hashPattern.test(input.logoSha256) || !hashPattern.test(input.portrait.sha256)) {
    throw new Error("Complete the badge details before reviewing.");
  }
  const cropFingerprint = portraitInputFingerprint(input.source, input.crop);
  const portrait = input.portrait;
  if (!["original", "cleaned"].includes(portrait.kind)) throw new Error("Choose a valid portrait.");
  if (portrait.employeeId !== input.profile.employeeId || !portrait.canRead
    || portrait.scanState !== "clean" || portrait.scanSha256.toLowerCase() !== portrait.sha256.toLowerCase()
    || portrait.inputFingerprint !== cropFingerprint) {
    throw new Error("Choose a checked portrait for the current employee, source and crop.");
  }
  if (portrait.kind === "cleaned"
    && ![portrait.operationId, portrait.modelRevision, portrait.promptRevision].every(isText)) {
    throw new Error("Review a cleaned photo for the current source and crop.");
  }
  return digest(["badge-review-v1", input.profile.employeeId, input.draftId,
    input.draftRevision, cropFingerprint, name, input.title, portrait.kind,
    portrait.sha256.toLowerCase(), portrait.kind === "cleaned"
      ? [portrait.operationId, portrait.modelRevision, portrait.promptRevision] : null,
    input.templateRevision, input.logoSha256.toLowerCase(), input.fontRevision,
    input.printProfileRevision]);
}

export function badgeReviewIsCurrent(reviewedFingerprint: string, current: BadgeReviewInput): boolean {
  try { return hashPattern.test(reviewedFingerprint) && reviewedFingerprint === badgeReviewFingerprint(current); }
  catch { return false; }
}
