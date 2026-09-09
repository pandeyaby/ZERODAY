/**
 * Findings helpers — evidence-id citation formatting for CISO reports.
 * (Legacy mission findings removed; defensive localization only.)
 */

export function formatEvidenceCitation(ids: string[]): string {
  if (!ids.length) return "_no evidence id_";
  return ids.map((id) => `\`${id}\``).join(", ");
}
