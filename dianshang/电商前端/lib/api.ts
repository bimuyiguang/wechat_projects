function browserApiBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:5177";
  const isLocalFrontend = ["127.0.0.1", "localhost"].includes(window.location.hostname) && window.location.port === "3000";
  return isLocalFrontend ? "http://127.0.0.1:5177" : "";
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || browserApiBase();

export async function fetchFromApi(path: string, options?: RequestInit) {
  const url = `${API_BASE}${path}`;
  const mergedOptions: RequestInit = {
    credentials: "include",
    ...options,
    headers: {
      ...options?.headers,
    }
  };
  const res = await fetch(url, mergedOptions);
  if (!res.ok) {
    let errMsg = `API error: ${res.status}`;
    try {
      const parsed = await res.json();
      if (parsed.message) errMsg = parsed.message;
    } catch {
      const errorText = await res.text().catch(() => "");
      if (errorText) errMsg = errorText;
    }
    throw new Error(errMsg);
  }
  return res.json();
}
