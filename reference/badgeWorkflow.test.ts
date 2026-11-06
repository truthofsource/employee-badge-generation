import assert from "node:assert/strict";
import test from "node:test";
import { badgeProfileName, badgeReviewFingerprint, badgeReviewIsCurrent,
  canManageEmployeeBadges, portraitInputFingerprint, resolveBadgeSource, validatePortraitCrop,
  type BadgeReviewInput, type SourceRecord } from "./badgeWorkflow.ts";

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);
const hr = ["Platform.HR"];
const record: SourceRecord = { employeeId: "fictional-employee", sourceId: "fictional-photo",
  kind: "stage2_id", current: true, canRead: true, scanState: "clean", contentType: "image/png",
  byteLength: 4096, width: 800, height: 1000, sha256: hash, scanSha256: hash,
  etag: "opaque-etag", versionId: "opaque-version", packetDocumentId: "fictional-packet-document" };
function readySource() {
  const result = resolveBadgeSource(record.employeeId, "stage2_id", hr, [record]);
  assert.equal(result.state, "ready");
  if (result.state !== "ready") throw new Error("Fixture not ready");
  return result.source;
}
function review(): BadgeReviewInput {
  const source = readySource();
  const crop = { x: 0.1, y: 0.1, width: 0.5, height: 0.6 };
  return { profile: { employeeId: record.employeeId, firstName: "Fictional", lastName: "Employee" },
    draftId: "draft-one", draftRevision: 1, source, crop,
    portrait: { kind: "original", employeeId: record.employeeId, sha256: otherHash,
      inputFingerprint: portraitInputFingerprint(source, crop), canRead: true, scanState: "clean", scanSha256: otherHash },
    title: "Caregiver", templateRevision: "one", logoSha256: hash,
    fontRevision: "one", printProfileRevision: "one" };
}

test("only HR/Admin may resolve badge sources; denial does not disclose candidate state", () => {
  assert.equal(canManageEmployeeBadges(["Platform.Admin"]), true);
  for (const roles of [[], ["Platform.Payroll"], ["Platform.Caregiver"], ["HR"], ["Platform.Supervisor"]]) {
    assert.deepEqual(resolveBadgeSource(record.employeeId, "stage2_id", roles, [record, record]), { state: "denied" });
  }
});

test("ID selection requires an exact employee and a unique current source", () => {
  assert.deepEqual(resolveBadgeSource(record.employeeId, "stage2_id", hr, []), { state: "missing" });
  assert.deepEqual(resolveBadgeSource(record.employeeId, "stage2_id", hr, [record, record]), { state: "conflict" });
  assert.deepEqual(resolveBadgeSource("someone-else", "stage2_id", hr, [record]), { state: "conflict" });
  assert.deepEqual(resolveBadgeSource(record.employeeId, "stage2_id", hr, [{ ...record, current: false }]), { state: "missing" });
  assert.deepEqual(resolveBadgeSource(record.employeeId, "stage2_id", hr, [{ ...record, canRead: false }]), { state: "unavailable" });
  assert.deepEqual(resolveBadgeSource(record.employeeId, "stage2_id", hr, [{ ...record, scanState: "pending" }]), { state: "processing" });
});

test("headshots remain independently selectable when the employee's ID is unavailable", () => {
  const headshot = { ...record, kind: "headshot" as const, sourceId: "headshot", packetDocumentId: undefined };
  const result = resolveBadgeSource(record.employeeId, "headshot", hr, [{ ...record, canRead: false }, headshot]);
  assert.equal(result.state, "ready");
  if (result.state === "ready") assert.equal("packetDocumentId" in result.source, false);
});

test("clean means exact scanned bytes with trusted immutable source metadata", () => {
  const invalid: Partial<SourceRecord>[] = [
    { scanState: "unavailable" }, { sha256: "not-a-hash" }, { scanSha256: otherHash },
    { contentType: "application/pdf" }, { byteLength: 0 }, { byteLength: 6 * 1024 * 1024 },
    { width: 0 }, { height: 0.5 }, { width: 10000, height: 10000 },
    { width: Number.NaN }, { etag: "" }, { versionId: "" }, { packetDocumentId: undefined },
  ];
  for (const change of invalid) assert.deepEqual(
    resolveBadgeSource(record.employeeId, "stage2_id", hr, [{ ...record, ...change }]),
    { state: "unavailable" }, JSON.stringify(change));
});

test("crop validation rejects nonfinite and out-of-photo coordinates", () => {
  const valid = review().crop;
  for (const crop of [{ ...valid, x: -0.1 }, { ...valid, y: 1 }, { ...valid, width: 0 },
    { ...valid, height: 2 }, { ...valid, x: Number.NaN }, { ...valid, y: Infinity }]) {
    assert.throws(() => validatePortraitCrop(crop), /crop within/);
  }
  assert.doesNotThrow(() => validatePortraitCrop({ x: 0, y: 0, width: 1, height: 1 }));
});

test("profile is the sole name source and preserves long names/diacritics", () => {
  assert.equal(badgeProfileName({ employeeId: "one", firstName: "  Zoë Anne  ", lastName: "O'Neill-Santos" }), "Zoë Anne O'Neill-Santos");
  assert.throws(() => badgeProfileName({ employeeId: "one", firstName: "", lastName: "Missing" }), /profile name/);
  const input = review();
  const spoofed = { ...input, displayName: "Browser override", profileName: "Another override" };
  assert.equal(badgeReviewFingerprint(input), badgeReviewFingerprint(spoofed));
});

test("cleanup identity changes with exact source/crop but contains no profile text", () => {
  const input = review();
  const original = portraitInputFingerprint(input.source, input.crop);
  assert.equal(original, portraitInputFingerprint({ ...input.source }, { ...input.crop }));
  assert.notEqual(original, portraitInputFingerprint({ ...input.source, versionId: "new" }, input.crop));
  assert.notEqual(original, portraitInputFingerprint(input.source, { ...input.crop, x: 0.2 }));
  assert.match(original, /^[a-f0-9]{64}$/);
});

test("every material change requires a new exact badge preview/review", () => {
  const input = review();
  const fingerprint = badgeReviewFingerprint(input);
  assert.equal(badgeReviewIsCurrent(fingerprint, review()), true);
  const changes: Partial<BadgeReviewInput>[] = [
    { profile: { ...input.profile, lastName: "Changed" } }, { draftRevision: 2 }, { draftId: "another-draft" },
    { title: "Another title" }, { templateRevision: "two" }, { logoSha256: otherHash },
    { fontRevision: "two" }, { printProfileRevision: "two" },
    { source: { ...input.source, etag: "new" } }, { source: { ...input.source, sha256: otherHash } },
    { crop: { ...input.crop, y: 0.2 } }, { portrait: { ...input.portrait, sha256: hash, scanSha256: hash } },
  ];
  for (const change of changes) assert.equal(badgeReviewIsCurrent(fingerprint, { ...input, ...change }), false, JSON.stringify(change));
  assert.equal(badgeReviewIsCurrent("", input), false);
});

test("cleaned photo cannot be reused after crop/source changes or cross-employee selection", () => {
  const input = review();
  input.portrait = { ...input.portrait, kind: "cleaned", sha256: otherHash, operationId: "operation-one",
    inputFingerprint: portraitInputFingerprint(input.source, input.crop), modelRevision: "evaluation-model",
    promptRevision: "portrait-background-v1" };
  const fingerprint = badgeReviewFingerprint(input);
  assert.equal(badgeReviewIsCurrent(fingerprint, input), true);
  assert.equal(badgeReviewIsCurrent(fingerprint, { ...input, crop: { ...input.crop, x: 0.2 } }), false);
  assert.equal(badgeReviewIsCurrent(fingerprint, { ...input, source: { ...input.source, employeeId: "another" } }), false);
  const changed = { ...input, portrait: { ...input.portrait, promptRevision: "v2" } };
  assert.equal(badgeReviewIsCurrent(fingerprint, changed), false);
});

test("original and cleaned derivatives both require exact owner, clean bytes and current crop", () => {
  for (const kind of ["original", "cleaned"] as const) {
    const input = review();
    if (kind === "cleaned") input.portrait = { ...input.portrait, kind,
      operationId: "operation", modelRevision: "model", promptRevision: "prompt" };
    const fingerprint = badgeReviewFingerprint(input);
    for (const change of [{ employeeId: "another" }, { canRead: false },
      { scanState: "pending" as const }, { scanState: "unavailable" as const },
      { scanSha256: hash }, { inputFingerprint: hash }]) {
      assert.equal(badgeReviewIsCurrent(fingerprint, { ...input, portrait: { ...input.portrait, ...change } }), false);
    }
    assert.throws(() => badgeReviewFingerprint({ ...input, crop: { ...input.crop, x: 0.2 } }), /current employee, source and crop/);
  }
});
