import { createHash, randomUUID } from "node:crypto";
import { BadgeDraftError, badgeUuid } from "./badgeErrors.ts";
import { badgeReviewFingerprint, canManageEmployeeBadges, type BadgeReviewInput } from "./badgeWorkflow.ts";

export type BadgeFile = { artifactId: string; employeeId: string; format: "png" | "pdf"; sha256: string; scanSha256: string;
  scanState: "pending" | "clean" | "unavailable"; canRead: boolean; versionId: string; etag: string; byteLength: number };
export type BadgePreparation = { portraitArtifactId?:string; preparationId: string; employeeId: string; reviewInput: BadgeReviewInput;
  png: BadgeFile; pdf: BadgeFile; preparedAtUtc: string };
export type BadgeReviewReceipt = { reviewId: string; employeeId: string; preparationId: string;
  fingerprint: string; actorId: string; reviewedAtUtc: string; reviewKind?:"manual_review"|"automatic_validation" };
export type IssuedBadge = { versionId: string; employeeId: string; preparationId: string; reviewId: string;
  fingerprint: string; actorId: string; issuedAtUtc: string; profileName: string; title: string; png: BadgeFile; pdf: BadgeFile; validationMethod?:"automatic_validation" };
export type BadgeRevokeReceipt = { versionId: string; employeeId: string; actorId: string; reason: string; revokedAtUtc: string };
export type BadgeLifecycleTransaction = {
  /** Rebuild from current profile, saved draft, source access and portrait proof.
   * Never trust an old preparation snapshot to establish current eligibility. */
  currentPreparation(preparationId: string, requireCurrentPolicy?:boolean): Promise<BadgePreparation | null>;
  review(reviewId: string): Promise<BadgeReviewReceipt | null>;
  issued(versionId: string): Promise<IssuedBadge | null>;
  issuedForPreparation(preparationId: string): Promise<IssuedBadge | null>;
  revocation(versionId: string): Promise<BadgeRevokeReceipt | null>;
  receipt(kind: "review" | "issue" | "revoke", actorId: string, requestKey: string): Promise<{ inputHash: string; result: unknown } | null>;
  saveReview(receipt: BadgeReviewReceipt): Promise<void>;
  saveIssued(badge: IssuedBadge): Promise<void>;
  saveRevocation(receipt: BadgeRevokeReceipt): Promise<void>;
  saveReceipt(kind: "review" | "issue" | "revoke", actorId: string, requestKey: string, inputHash: string, result: unknown): Promise<void>;
  audit(action: string, actorId: string, references: { operationId?:string; artifactId?:string; preparationId?: string; reviewId?: string; versionId?: string }): Promise<void>;
};
export type BadgeLifecycleRepository = { withEmployeeLock<T>(employeeId: string, work: (tx: BadgeLifecycleTransaction) => Promise<T>): Promise<T> };
const hash = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
const hashPattern = /^[a-f0-9]{64}$/;
function access(employeeId: string, actorId: string, roles: readonly string[], requestKey: string) {
  if (!canManageEmployeeBadges(roles)) throw new BadgeDraftError(403, "Badge access is unavailable.");
  if (![employeeId, actorId, requestKey].every(value => badgeUuid.test(value))) throw new BadgeDraftError(400, "Choose a valid employee and verified staff request.");
}
export function badgePreparationFingerprint(preparation: BadgePreparation) {
  const files = [preparation.png, preparation.pdf];
  if (preparation.employeeId !== preparation.reviewInput.profile.employeeId || !badgeUuid.test(preparation.preparationId)
    || files.some((file,index) => file.employeeId !== preparation.employeeId || file.format !== (index === 0 ? "png" : "pdf")
      || !badgeUuid.test(file.artifactId) || !file.canRead || file.scanState !== "clean" || !hashPattern.test(file.sha256)
      || file.scanSha256 !== file.sha256 || !file.versionId || !file.etag || !Number.isSafeInteger(file.byteLength)
      || file.byteLength < 1 || file.byteLength > 8 * 1024 * 1024)) throw new BadgeDraftError(409, "Wait for both badge files to finish their file checks, then review the current preview.");
  let contentFingerprint: string;
  try { contentFingerprint=badgeReviewFingerprint(preparation.reviewInput); }
  catch { throw new BadgeDraftError(409,"The photo, crop or employee details changed. Prepare and review the current badge again."); }
  return hash(["badge-exact-artifact-review-v1", preparation.preparationId, contentFingerprint,
    ...files.map(file => [file.artifactId, file.format, file.sha256, file.versionId, file.etag, file.byteLength])]);
}
async function replay<T>(tx: BadgeLifecycleTransaction, kind: "review" | "issue" | "revoke", actorId: string,
  requestKey: string, inputHash: string): Promise<{ found: false } | { found: true; result: T }> {
  const receipt = await tx.receipt(kind, actorId, requestKey);
  if (!receipt) return { found: false };
  if (receipt.inputHash !== inputHash) throw new BadgeDraftError(409, "This request has different details. Reload its saved status.");
  return { found: true, result: receipt.result as T };
}

/** All mutations/receipts/audits share one transaction and employee lock.
 * Issuance stores exact artifacts; reprinting never re-renders or calls OpenAI. */
export function createBadgeIssuance(repository: BadgeLifecycleRepository, now = () => new Date().toISOString()) {
  return {
    async review(employeeId: string, actorId: string, roles: readonly string[], input: {
      preparationId: string; fingerprint: string; requestKey: string; confirmedExactPreview: boolean; confirmedPortraitComparison: boolean;
    }): Promise<BadgeReviewReceipt> {
      access(employeeId, actorId, roles, input.requestKey);
      if (!badgeUuid.test(input.preparationId) || !hashPattern.test(input.fingerprint) || input.confirmedExactPreview !== true) throw new BadgeDraftError(400, "Review the exact badge preview before confirming.");
      return repository.withEmployeeLock(employeeId, async tx => {
        const inputHash = hash([input.preparationId,input.fingerprint,input.confirmedExactPreview,input.confirmedPortraitComparison]);
        const previous = await replay<BadgeReviewReceipt>(tx,"review",actorId,input.requestKey,inputHash); if (previous.found) return previous.result;
        const preparation = await tx.currentPreparation(input.preparationId,true);
        if (!preparation || preparation.employeeId !== employeeId || badgePreparationFingerprint(preparation) !== input.fingerprint) throw new BadgeDraftError(409, "The badge or employee details changed. Review the current preview again.");
        if (preparation.reviewInput.portrait.kind === "cleaned" && input.confirmedPortraitComparison !== true) throw new BadgeDraftError(400, "Compare the cleaned portrait with the original before confirming.");
        const receipt: BadgeReviewReceipt = { reviewId: randomUUID(), employeeId, preparationId: input.preparationId,
          fingerprint: input.fingerprint, actorId, reviewedAtUtc: now() };
        await tx.saveReview(receipt); await tx.audit("employee.badge_reviewed",actorId,{ preparationId:input.preparationId,reviewId:receipt.reviewId });
        await tx.saveReceipt("review",actorId,input.requestKey,inputHash,receipt); return receipt;
      });
    },
    async issue(employeeId: string, actorId: string, roles: readonly string[], input: { reviewId?: string; preparationId?:string; fingerprint?:string; requestKey: string }): Promise<IssuedBadge> {
      access(employeeId, actorId, roles, input.requestKey);
      const direct=input.preparationId!==undefined;
      if(direct?typeof input.preparationId!=="string"||!badgeUuid.test(input.preparationId)||typeof input.fingerprint!=="string"||!hashPattern.test(input.fingerprint)||input.reviewId!==undefined:typeof input.reviewId!=="string"||!badgeUuid.test(input.reviewId)||input.fingerprint!==undefined)throw new BadgeDraftError(400,"Choose the current badge and saved file version.");
      return repository.withEmployeeLock(employeeId, async tx => {
        const inputHash = direct?hash(["direct-issue-v1",input.preparationId,input.fingerprint]):hash([input.reviewId]);
        const previous = await replay<IssuedBadge>(tx,"issue",actorId,input.requestKey,inputHash);
        if (previous.found) {
          if(await tx.revocation(previous.result.versionId))throw new BadgeDraftError(409,"This badge was revoked. Prepare and review a replacement.");
          return previous.result;
        }
        let reviewed:BadgeReviewReceipt|null=null;
        if(!direct){reviewed=await tx.review(input.reviewId!);if(!reviewed||reviewed.employeeId!==employeeId)throw new BadgeDraftError(404,"The saved badge is unavailable.");}
        const preparationId=direct?input.preparationId!:reviewed!.preparationId;
        let issued=await tx.issuedForPreparation(preparationId);
        const preparation=await tx.currentPreparation(preparationId,!issued);
        const fingerprint=direct?input.fingerprint!:reviewed!.fingerprint;
        if(!preparation||preparation.employeeId!==employeeId||badgePreparationFingerprint(preparation)!==fingerprint)throw new BadgeDraftError(409,"The badge or employee details changed. Prepare the current badge again.");
        // Validation and issuance use one transaction, with no human approval attestation.
        if(!issued&&direct){
          reviewed={reviewId:randomUUID(),employeeId,preparationId:preparation.preparationId,fingerprint,actorId,reviewedAtUtc:now(),reviewKind:"automatic_validation"};
          await tx.saveReview(reviewed);await tx.audit("employee.badge_automatically_validated",actorId,{preparationId:preparation.preparationId,reviewId:reviewed.reviewId});
        }
        if (!issued) {
          issued = { versionId: randomUUID(), employeeId, preparationId: preparation.preparationId, reviewId: reviewed!.reviewId,
            fingerprint, actorId, issuedAtUtc: now(),
            profileName: `${preparation.reviewInput.profile.firstName.trim()} ${preparation.reviewInput.profile.lastName.trim()}`,
            title: preparation.reviewInput.title,...(direct?{validationMethod:"automatic_validation" as const}:{}), png: { ...preparation.png }, pdf: { ...preparation.pdf } };
          await tx.saveIssued(issued); await tx.audit("employee.badge_issued",actorId,{ preparationId:issued.preparationId,reviewId:issued.reviewId,versionId:issued.versionId });
        }
        if (await tx.revocation(issued.versionId)) throw new BadgeDraftError(409, "This badge was revoked. Prepare and review a replacement.");
        await tx.saveReceipt("issue",actorId,input.requestKey,inputHash,issued); return issued;
      });
    },
    async revoke(employeeId: string, actorId: string, roles: readonly string[], input: { versionId: string; reason: string; requestKey: string }): Promise<BadgeRevokeReceipt> {
      access(employeeId, actorId, roles, input.requestKey);
      if (!badgeUuid.test(input.versionId) || typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 500 || /[\x00-\x1f\x7f]/.test(input.reason)) throw new BadgeDraftError(400, "Choose a badge and give a short revocation reason.");
      return repository.withEmployeeLock(employeeId, async tx => {
        const inputHash = hash([input.versionId,input.reason.trim()]);
        const previous = await replay<BadgeRevokeReceipt>(tx,"revoke",actorId,input.requestKey,inputHash); if (previous.found) return previous.result;
        const issued = await tx.issued(input.versionId);
        if (!issued || issued.employeeId !== employeeId) throw new BadgeDraftError(404, "The issued badge is unavailable.");
        let receipt = await tx.revocation(input.versionId);
        if (!receipt) {
          receipt = { versionId:input.versionId,employeeId,actorId,reason:input.reason.trim(),revokedAtUtc:now() };
          await tx.saveRevocation(receipt); await tx.audit("employee.badge_revoked",actorId,{ versionId:input.versionId });
        }
        await tx.saveReceipt("revoke",actorId,input.requestKey,inputHash,receipt); return receipt;
      });
    },
    async downloadable(employeeId: string, actorId: string, roles: readonly string[], versionId: string, format: "png" | "pdf") {
      access(employeeId,actorId,roles,versionId);
      if (!["png","pdf"].includes(format)) throw new BadgeDraftError(400,"Choose PNG or PDF.");
      return repository.withEmployeeLock(employeeId,async tx => {
        const issued = await tx.issued(versionId);
        if (!issued || issued.employeeId !== employeeId) throw new BadgeDraftError(404,"This badge is unavailable.");
        if (await tx.revocation(versionId)) throw new BadgeDraftError(409,"This badge was revoked. Use its reviewed replacement.");
        const file = issued[format];
        if (file.employeeId !== employeeId || file.format !== format || !file.canRead || file.scanState !== "clean"
          || !hashPattern.test(file.sha256) || file.scanSha256 !== file.sha256 || !file.etag || !file.versionId
          || !Number.isSafeInteger(file.byteLength) || file.byteLength<1 || file.byteLength>8*1024*1024) throw new BadgeDraftError(409,"This badge file is unavailable.");
        await tx.audit("employee.badge_download_authorized",actorId,{ versionId });
        return { ...file }; // Byte adapter must still verify exact version/ETag/hash.
      });
    },
  };
}
