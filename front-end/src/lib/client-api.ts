"use client";

export async function clientApi(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (response.status === 401)
    throw new Error("Your session has expired. Sign in again to continue.");
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const message =
      typeof data === "object" &&
      data &&
      "error" in data &&
      typeof data.error === "object" &&
      data.error &&
      "message" in data.error &&
      typeof data.error.message === "string"
        ? data.error.message
        : "We couldn’t complete that request. Please try again.";
    throw new Error(message);
  }
  return response.json() as Promise<unknown>;
}
