export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  if (error instanceof ApiError) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

export function apiErrorResponse(error: unknown): Response {
  if (isApiError(error)) {
    return Response.json(
      { ok: false, error: error.message, details: error.details ?? null },
      { status: error.status }
    );
  }
  // Safe server-side error logging without exposing credentials or sensitive connection strings
  const safeMessage = error instanceof Error ? (error.stack || error.message) : String(error);
  console.error("[api] unhandled error:", safeMessage);
  return Response.json({ ok: false, error: "Unexpected server error" }, { status: 500 });
}
