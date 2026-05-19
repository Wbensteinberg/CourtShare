import { FieldValue, type Firestore } from "firebase-admin/firestore";

type AuditDetails = Record<
  string,
  string | number | boolean | null | undefined
>;

export async function writeSecurityAuditLog(
  db: Firestore | null | undefined,
  eventType: string,
  details: AuditDetails
) {
  if (!db) return;

  const sanitized = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  );

  try {
    await db.collection("securityAuditLogs").add({
      eventType,
      ...sanitized,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[SECURITY-AUDIT] Failed to write audit log:", err);
  }
}
