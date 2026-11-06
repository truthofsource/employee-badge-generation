// Public type-only ports extracted from the hosted database/blob boundaries.
import type {IssuedBadge,BadgeRevokeReceipt} from "./badgeIssuance.ts";
export type BadgeArtifactTicket = {employeeId:string;kind:string;sha256:string;scanSha256:string;
  scanState:"pending"|"clean"|"unavailable";etag:string;versionId:string;contentType:string};
export type BadgeLifecycleUnit = {
  assertSelf(actorId:string):Promise<void>;
  issuedIds():Promise<string[]>;
  issued(id:string):Promise<IssuedBadge|null>;
  revocation(id:string):Promise<BadgeRevokeReceipt|null>;
  artifact(id:string):Promise<BadgeArtifactTicket|null>;
};
