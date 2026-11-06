import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { badgePreparationFingerprint, createBadgeIssuance, type BadgeLifecycleRepository, type BadgeLifecycleTransaction,
  type BadgePreparation, type BadgeReviewReceipt, type BadgeRevokeReceipt, type IssuedBadge } from "./badgeIssuance.ts";
import { portraitInputFingerprint } from "./badgeWorkflow.ts";

const employeeId = "00000000-0000-4000-8000-000000000001", actorId = "00000000-0000-4000-8000-000000000002";
const roles = ["Platform.HR"];
function fixture() {
  const source = { employeeId, sourceId: randomUUID(), kind: "headshot" as const, sha256: "a".repeat(64), etag: "source-etag", versionId: "source-version", width: 400, height: 600 };
  const crop = { x: 0, y: 0, width: 1, height: 1 };
  const file = (format: "png" | "pdf") => ({ artifactId: randomUUID(), employeeId, format, sha256: "b".repeat(64), scanSha256: "b".repeat(64), scanState: "clean" as const,
    canRead: true, versionId: format + "-version", etag: format + "-etag", byteLength: 100 });
  const preparation: BadgePreparation = { preparationId: randomUUID(), employeeId, preparedAtUtc: "2026-10-30T12:00:00.000Z", png: file("png"), pdf: file("pdf"), reviewInput: {
    profile: { employeeId, firstName: "Fictional", lastName: "Employee" }, draftId: randomUUID(), draftRevision: 1,
    source, crop, portrait: { employeeId, kind: "original", sha256: "c".repeat(64), scanSha256: "c".repeat(64), scanState: "clean", canRead: true,
      inputFingerprint: portraitInputFingerprint(source, crop) }, title: "Caregiver", templateRevision: "template-v1", logoSha256: "d".repeat(64), fontRevision: "font-v1", printProfileRevision: "print-v1",
  } };
  const reviews = new Map<string,BadgeReviewReceipt>(), issued = new Map<string,IssuedBadge>(), revoked = new Map<string,BadgeRevokeReceipt>();
  const receipts = new Map<string,{inputHash:string;result:unknown}>(); let audits = 0, locks = 0;
  const tx: BadgeLifecycleTransaction = {
    currentPreparation: async id => id === preparation.preparationId ? preparation : null,
    review: async id => reviews.get(id) ?? null, issued: async id => issued.get(id) ?? null,
    issuedForPreparation: async id => [...issued.values()].find(row => row.preparationId === id) ?? null,
    revocation: async id => revoked.get(id) ?? null,
    receipt: async (kind,actor,key) => receipts.get([kind,actor,key].join(":")) ?? null,
    saveReview: async row => { reviews.set(row.reviewId, row); }, saveIssued: async row => { issued.set(row.versionId,structuredClone(row)); },
    saveRevocation: async row => { revoked.set(row.versionId,row); },
    saveReceipt: async (kind,actor,key,inputHash,result) => { receipts.set([kind,actor,key].join(":"),{inputHash,result:structuredClone(result)}); },
    audit: async () => { audits++; },
  };
  const repository: BadgeLifecycleRepository = { async withEmployeeLock(id,work) { assert.equal(id,employeeId); locks++; return work(tx); } };
  const service = createBadgeIssuance(repository,()=>"2026-10-30T12:00:00.000Z");
  const reviewInput = () => ({ preparationId:preparation.preparationId,fingerprint:badgePreparationFingerprint(preparation),requestKey:randomUUID(),confirmedExactPreview:true,confirmedPortraitComparison:false });
  return {service,preparation,tx,reviewInput,issued,reviews,revoked,audits:()=>audits,locks:()=>locks};
}

test("badge review and issuance are repeat-safe, actor-bound and produce one immutable version", async () => {
  const f=fixture(),input=f.reviewInput();
  const review=await f.service.review(employeeId,actorId,roles,input);
  assert.deepEqual(await f.service.review(employeeId,actorId,roles,input),review); assert.equal(f.reviews.size,1);
  const issue={reviewId:review.reviewId,requestKey:randomUUID()}; const version=await f.service.issue(employeeId,actorId,roles,issue);
  assert.deepEqual(await f.service.issue(employeeId,actorId,roles,issue),version);
  assert.deepEqual(await f.service.issue(employeeId,actorId,roles,{...issue,requestKey:randomUUID()}),version);
  assert.equal(f.issued.size,1); assert.equal(f.audits(),2); assert.equal(version.profileName,"Fictional Employee");
  await assert.rejects(f.service.review(employeeId,actorId,roles,{...input,confirmedPortraitComparison:true}),/different details/);
});

test("profile, draft, crop, artifact and template changes invalidate a prior review before issue", async () => {
  for (const change of [
    (p:BadgePreparation)=>{p.reviewInput.profile.lastName="Changed";},
    (p:BadgePreparation)=>{p.reviewInput.draftRevision++;},
    (p:BadgePreparation)=>{p.reviewInput.crop.width=.5;},
    (p:BadgePreparation)=>{p.png.etag="new-etag";},
    (p:BadgePreparation)=>{p.reviewInput.templateRevision="template-v2";},
  ]) {
    const f=fixture(),review=await f.service.review(employeeId,actorId,roles,f.reviewInput()); change(f.preparation);
    await assert.rejects(f.service.issue(employeeId,actorId,roles,{reviewId:review.reviewId,requestKey:randomUUID()}));assert.equal(f.issued.size,0);
  }
});

test("pending files, foreign ownership, denied roles and missing portrait comparison cannot be approved", async () => {
  const f=fixture(); await assert.rejects(f.service.review(employeeId,actorId,["Platform.Caregiver"],f.reviewInput()),/access/);assert.equal(f.locks(),0);
  f.preparation.png.scanState="pending" as "clean"; assert.throws(()=>f.reviewInput(),/file checks/);
  f.preparation.png.scanState="clean"; f.preparation.png.employeeId=randomUUID();assert.throws(()=>f.reviewInput(),/file checks/);
  f.preparation.png.employeeId=employeeId;
  f.preparation.reviewInput.portrait={...f.preparation.reviewInput.portrait,kind:"cleaned",operationId:randomUUID(),modelRevision:"test-model",promptRevision:"prompt-v1"};
  await assert.rejects(f.service.review(employeeId,actorId,roles,f.reviewInput()),/Compare/);
  await f.service.review(employeeId,actorId,roles,{...f.reviewInput(),confirmedPortraitComparison:true});assert.equal(f.reviews.size,1);
});

test("reprint returns stored files; revocation blocks reprint and cannot silently reissue the same preparation", async () => {
  const f=fixture(),review=await f.service.review(employeeId,actorId,roles,f.reviewInput());
  const issue={reviewId:review.reviewId,requestKey:randomUUID()};
  const version=await f.service.issue(employeeId,actorId,roles,issue);
  assert.deepEqual(await f.service.downloadable(employeeId,actorId,roles,version.versionId,"pdf"),version.pdf);
  const revoke={versionId:version.versionId,reason:"Replace damaged badge",requestKey:randomUUID()};
  const receipt=await f.service.revoke(employeeId,actorId,roles,revoke);
  assert.deepEqual(await f.service.revoke(employeeId,actorId,roles,revoke),receipt);assert.equal(f.revoked.size,1);
  await assert.rejects(f.service.downloadable(employeeId,actorId,roles,version.versionId,"png"),/revoked/);
  await assert.rejects(f.service.issue(employeeId,actorId,roles,issue),/revoked/);
  await assert.rejects(f.service.issue(employeeId,actorId,roles,{reviewId:review.reviewId,requestKey:randomUUID()}),/revoked/);
  assert.equal(f.issued.size,1);
});

test("audit failure withholds successful review response", async () => {
  const f=fixture();f.tx.audit=async()=>{throw Error("audit unavailable");};
  await assert.rejects(f.service.review(employeeId,actorId,roles,f.reviewInput()),/audit unavailable/);
  // This fake tests withholding only; real transaction rollback is SQL acceptance.
});

test("direct issuance needs no human review and records automatic validation exactly once",async()=>{
 const f=fixture();const input={preparationId:f.preparation.preparationId,fingerprint:badgePreparationFingerprint(f.preparation),requestKey:randomUUID()};
 const result=await f.service.issue(employeeId,actorId,roles,input);
 assert.equal(result.validationMethod,"automatic_validation");assert.equal(f.reviews.get(result.reviewId)?.reviewKind,"automatic_validation");
 assert.deepEqual(await f.service.issue(employeeId,actorId,roles,input),result);
 assert.deepEqual(await f.service.issue(employeeId,actorId,roles,{...input,requestKey:randomUUID()}),result);
 assert.equal(f.issued.size,1);assert.equal(f.reviews.size,1);assert.equal(f.audits(),2);
 await assert.rejects(f.service.issue(employeeId,actorId,roles,{...input,fingerprint:"a".repeat(64)}),/different details/);
 await f.service.revoke(employeeId,actorId,roles,{versionId:result.versionId,reason:"Fictional test",requestKey:randomUUID()});
 await assert.rejects(f.service.issue(employeeId,actorId,roles,input),/revoked/);
});
test("direct issuance still rejects changed, foreign, scan-pending and unauthorized badges",async()=>{
 for(const kind of ["changed","foreign","pending","caregiver"]){
  const f=fixture(),input={preparationId:f.preparation.preparationId,fingerprint:badgePreparationFingerprint(f.preparation),requestKey:randomUUID()};
  if(kind==="changed")f.preparation.reviewInput.draftRevision++;
  if(kind==="foreign")f.preparation.employeeId=randomUUID();
  if(kind==="pending")f.preparation.png.scanState="pending" as "clean";
  await assert.rejects(f.service.issue(employeeId,actorId,kind==="caregiver"?["Platform.Caregiver"]:roles,input));
  assert.equal(f.issued.size,0);assert.equal(f.reviews.size,0);
 }
});

test("first issuance requires current policy; already issued immutable copies remain reusable",async()=>{
 const f=fixture(),input={preparationId:f.preparation.preparationId,fingerprint:badgePreparationFingerprint(f.preparation),requestKey:randomUUID()};
 const read=f.tx.currentPreparation;const checks:boolean[]=[];let legacy=true;
 f.tx.currentPreparation=async(id,current)=>{checks.push(current===true);return legacy&&current?null:read(id);};
 await assert.rejects(f.service.issue(employeeId,actorId,roles,input),/Prepare the current badge/);
 assert.equal(f.issued.size,0);assert.equal(f.reviews.size,0);
 legacy=false;const issued=await f.service.issue(employeeId,actorId,roles,input);legacy=true;
 assert.deepEqual(await f.service.issue(employeeId,actorId,roles,{...input,requestKey:randomUUID()}),issued);
 assert.deepEqual(checks,[true,true,false]);assert.equal(f.issued.size,1);
});
