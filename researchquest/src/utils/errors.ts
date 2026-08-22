export function extractFunctionErrorMessage(
  error: any,
  fallback: string,
): string {
  if (!error) return fallback;

  if (typeof error === "string" && error.trim()) return error;

  const candidates: any[] = [];

  if (error.context) {
    const context = error.context;
    candidates.push(context.body, context.response);
    if (context.response) {
      candidates.push(context.response.error, context.response.data);
    }
  }

  if (error.error) {
    candidates.push(error.error);
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      if (candidate.trim()) return candidate;
      continue;
    }

    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message.trim();
    }

    if (candidate.error) {
      if (typeof candidate.error === "string" && candidate.error.trim()) {
        return candidate.error.trim();
      }

      if (
        typeof candidate.error.message === "string" &&
        candidate.error.message.trim()
      ) {
        return candidate.error.message.trim();
      }
    }
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}
