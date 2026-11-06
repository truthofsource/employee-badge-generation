import test from "node:test";
import assert from "node:assert/strict";
import {createBadgeSelfService} from "./badgeSelfService.ts";
import {BadgeDraftError} from "./badgeErrors.ts";
import type {BadgeArtifactTicket} from "./badgePorts.ts";
import type {IssuedBadge} from "./badgeIssuance.ts";
const employee="00000000-0000-4000-8000-000000000001",actor="00000000-0000-4000-8000-000000000002",version="00000000-0000-4000-8000-000000000003";
function fixture(){
 let owner=true,revoked=false,reads=0;const ticket={employeeId:employee,kind:"badge_png",sha256:"a".repeat(64),scanSha256:"a".repeat(64),scanState:"clean",etag:"etag",versionId:"blob-v1",contentType:"image/png"} as BadgeArtifactTicket;
 const issued={employeeId:employee,versionId:version,profileName:"Fictional Employee",title:"Caregiver",issuedAtUtc:"2026-10-30T12:00:00Z",png:{...ticket,artifactId:actor},pdf:{artifactId:version}} as unknown as IssuedBadge;
 const tx={assertSelf:async(id:string)=>{assert.equal(id,actor);if(!owner)throw new BadgeDraftError(403,"Unlinked.");},
  issuedIds:async()=>[version],issued:async()=>issued,revocation:async()=>revoked?{}:null,artifact:async()=>ticket};
 const service=createBadgeSelfService({resolveSelf:async()=>employee,repository:{withEmployeeLock:async(id,work)=>{assert.equal(id,employee);return work(tx as unknown as Parameters<typeof work>[0]);}},
  read:async(id,value)=>{assert.equal(id,employee);assert.equal(value,ticket);reads++;return Buffer.from("fictional");}});
 return {service,ticket,issued,setOwner:(value:boolean)=>owner=value,revoke:()=>revoked=true,reads:()=>reads};
}
test("employee receives only the latest issued badge projection and exact owned file",async()=>{
 const f=fixture(),current=await f.service.current(actor);assert.deepEqual(Object.keys(current.badge!).sort(),["issuedAtUtc","profileName","title","versionId"]);
 assert.equal((await f.service.content(actor,version,"png")).employeeId,employee);assert.equal(f.reads(),1);
 await assert.rejects(()=>f.service.content(actor,actor,"png"),error=>(error as BadgeDraftError).status===404);assert.equal(f.reads(),1);
});
test("lost or ambiguous account ownership is rechecked inside the employee lock before any data or bytes",async()=>{
 const f=fixture();f.setOwner(false);await assert.rejects(()=>f.service.current(actor),error=>(error as BadgeDraftError).status===403);
 await assert.rejects(()=>f.service.content(actor,version,"png"));assert.equal(f.reads(),0);
});
test("revocation, cross-person artifact and negative scan all prevent employee file release",async()=>{
 const f=fixture();f.ticket.scanState="pending";await assert.rejects(()=>f.service.content(actor,version,"png"));assert.equal(f.reads(),0);
 f.ticket.scanState="clean";f.ticket.employeeId=actor;await assert.rejects(()=>f.service.content(actor,version,"png"));assert.equal(f.reads(),0);
 f.revoke();assert.equal((await f.service.current(actor)).badge,null);await assert.rejects(()=>f.service.content(actor,version,"png"));assert.equal(f.reads(),0);
});
