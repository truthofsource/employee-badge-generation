// Error shape extracted from the application's draft boundary.
export class BadgeDraftError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const badgeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
