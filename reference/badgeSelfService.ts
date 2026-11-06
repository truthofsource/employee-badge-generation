import {BadgeDraftError,badgeUuid} from "./badgeErrors.ts";
import type {BadgeLifecycleUnit} from "./badgePorts.ts";
import type {BadgeArtifactTicket} from "./badgePorts.ts";

type SelfUnit=Pick<BadgeLifecycleUnit,"assertSelf"|"issuedIds"|"issued"|"revocation"|"artifact">;
type Dependencies={resolveSelf(actorId:string):Promise<string>;
 repository:{withEmployeeLock<T>(employeeId:string,work:(tx:SelfUnit)=>Promise<T>):Promise<T>};
 read(employeeId:string,ticket:BadgeArtifactTicket):Promise<Buffer>};
/** Read-only self service. No role elevation, employee selector, draft or portrait access. */
export function createBadgeSelfService(deps:Dependencies){
 async function owned<T>(actorId:string,work:(tx:SelfUnit,employeeId:string)=>Promise<T>){
  if(!badgeUuid.test(actorId))throw new BadgeDraftError(403,"A verified employee account is required.");
  const employeeId=await deps.resolveSelf(actorId);
  if(!badgeUuid.test(employeeId))throw new BadgeDraftError(403,"Your employee account link is unavailable.");
  return deps.repository.withEmployeeLock(employeeId,async tx=>{await tx.assertSelf(actorId);return work(tx,employeeId);});
 }
 return {
  async current(actorId:string){return owned(actorId,async(tx,employeeId)=>{
   const id=(await tx.issuedIds())[0];
   const issued=id&&!await tx.revocation(id)?await tx.issued(id):null;
   if(issued&&(issued.employeeId!==employeeId||issued.versionId!==id))throw new BadgeDraftError(409,"Your badge record is unavailable. Contact HR.");
   return {ok:true as const,employeeId,badge:issued?{versionId:issued.versionId,issuedAtUtc:issued.issuedAtUtc,
    profileName:issued.profileName,title:issued.title}:null};
  });},
  async content(actorId:string,versionId:string,format:"png"|"pdf"){
   if(!badgeUuid.test(versionId)||!["png","pdf"].includes(format))throw new BadgeDraftError(400,"Choose a valid badge file.");
   return owned(actorId,async(tx,employeeId)=>{
    if((await tx.issuedIds())[0]!==versionId||await tx.revocation(versionId))throw new BadgeDraftError(404,"Your current badge is unavailable. Contact HR.");
    const issued=await tx.issued(versionId);
    if(!issued||issued.employeeId!==employeeId)throw new BadgeDraftError(404,"Your badge is unavailable.");
    const file=issued[format],ticket=await tx.artifact(file.artifactId);
    if(!ticket||ticket.employeeId!==employeeId||ticket.kind!==(format==="png"?"badge_png":"badge_pdf")
     ||ticket.scanState!=="clean"||ticket.scanSha256!==ticket.sha256
     ||ticket.sha256!==file.sha256||ticket.versionId!==file.versionId||ticket.etag!==file.etag)
     throw new BadgeDraftError(409,"Your badge file is unavailable. Contact HR.");
    // Exact byte/hash/scan validation remains mandatory inside the trusted reader.
    return {employeeId,contentType:ticket.contentType,bytes:await deps.read(employeeId,ticket)};
   });
  },
 };
}
