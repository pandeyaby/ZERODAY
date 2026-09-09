/**
 * Default served model ID for live Antares localization.
 * cisco-antares-cli requires an explicit model ID (--model / ANTARES_MODEL).
 * When the operator sets --endpoint, ZERODAY defaults to the public 1B checkpoint
 * so "Inference requires an explicit model ID" does not happen by accident.
 */

export const DEFAULT_ANTARES_MODEL = "fdtn-ai/antares-1b";

/**
 * Resolve the model ID for a live run.
 * Precedence: explicit CLI/option → ANTARES_MODEL env → DEFAULT_ANTARES_MODEL.
 */
export function resolveLiveModel(explicit?: string | null): string {
  const fromOpt = explicit?.trim();
  if (fromOpt) return fromOpt;
  const fromEnv = process.env.ANTARES_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_ANTARES_MODEL;
}
