export async function readApiJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    const message = typeof payload?.error === "string" && payload.error.trim()
      ? payload.error
      : fallbackMessage;
    throw new Error(message);
  }
  return payload as T;
}
