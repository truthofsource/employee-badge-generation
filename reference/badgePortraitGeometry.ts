export type PortraitPoint = { x: number; y: number };
export type PortraitPreparation = {
  revision: "headshot-preparation-v1";
  rotation: 0 | 90 | 180 | 270;
  corners?: [PortraitPoint, PortraitPoint, PortraitPoint, PortraitPoint];
  mainPortraitConfirmed: boolean;
  detailVisible: boolean;
  headshotRequired?: boolean;
};

export function validatePortraitPreparation(value: unknown): asserts value is PortraitPreparation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Review the portrait preparation.");
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !["revision", "rotation", "corners", "mainPortraitConfirmed", "detailVisible", "headshotRequired"].includes(k))
    || p.revision !== "headshot-preparation-v1" || ![0, 90, 180, 270].includes(p.rotation as number)
    || typeof p.mainPortraitConfirmed !== "boolean" || typeof p.detailVisible !== "boolean" || p.headshotRequired!==undefined&&typeof p.headshotRequired!=="boolean") {
    throw Error("Confirm the main portrait and clearly visible facial detail, or use a separate headshot.");
  }
  if (p.corners !== undefined) {
    if (!Array.isArray(p.corners) || p.corners.length !== 4) throw Error("Choose the four portrait corners.");
    const points = p.corners as PortraitPoint[];
    if (points.some(q => !q || typeof q !== "object" || Array.isArray(q)
      || Object.keys(q).length !== 2 || !Object.keys(q).every(k => k === "x" || k === "y")
      || ![q.x, q.y].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1))) {
      throw Error("Keep all portrait corners inside the crop.");
    }
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (cross <= .002 || Math.hypot(b.x - a.x, b.y - a.y) < .05) {
        throw Error("Choose four distinct corners in clockwise order without crossing edges.");
      }
      area += a.x * b.y - b.x * a.y;
    }
    if (area / 2 < .10) throw Error("Choose a larger, clearly defined portrait area.");
  }
}

export function portraitPreparationIdentity(p: PortraitPreparation): unknown[] {
  validatePortraitPreparation(p);
  return [p.revision,p.rotation,p.corners?.flatMap(q=>[q.x,q.y])??null,p.mainPortraitConfirmed,p.detailVisible,p.headshotRequired??false];
}
