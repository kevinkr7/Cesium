/**
 * ============================================================================
 * CESIUM SECURITY & SANITIZATION ENGINE
 * ============================================================================
 * Defense-in-depth sanitization routines protecting against XSS, SQL injection,
 * PostgREST parameter manipulation, path traversal, and malicious payloads.
 */

// Reserved system handles that cannot be registered or claimed
export const RESERVED_HANDLES = new Set([
  "admin",
  "administrator",
  "cesium",
  "system",
  "moderator",
  "mod",
  "support",
  "security",
  "root",
  "api",
  "null",
  "undefined",
]);

function stripControlChars(str: string, allowNewlines = true): string {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      res += str[i];
    } else if (allowNewlines && (code === 9 || code === 10 || code === 13)) {
      res += str[i];
    }
  }
  return res;
}

/**
 * Strips all HTML tags and control characters from an untrusted string.
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== "string") return "";

  const stripped = input
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove style tags and contents
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Remove any remaining HTML tags
    .replace(/<[^>]*>/g, "")
    // Neutralize dangerous pseudo-protocols
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:text\/html/gi, "");

  return stripControlChars(stripped, true);
}

/**
 * Escapes HTML entity characters for safe text insertion into markup or attributes.
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";

  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
  };

  return input.replace(/[&<>"'/`]/g, (match) => map[match] || match);
}

/**
 * Normalizes and sanitizes a user handle (@username).
 * Strips '@', trims, converts to lowercase, and permits only [a-z0-9_].
 */
export function sanitizeHandle(handle: string): string {
  if (!handle || typeof handle !== "string") return "";
  return handle
    .replace(/^@+/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

/**
 * Validates a user handle against strict production criteria.
 */
export function validateHandle(handle: string): { valid: boolean; error: string | null } {
  if (!handle || typeof handle !== "string") {
    return { valid: false, error: "Handle is required." };
  }

  const rawClean = handle.replace(/^@+/, "").trim().toLowerCase();

  if (rawClean.length < 3) {
    return { valid: false, error: "Handle must be at least 3 characters long." };
  }
  if (rawClean.length > 30) {
    return { valid: false, error: "Handle cannot exceed 30 characters." };
  }
  if (!/^[a-z0-9_]+$/.test(rawClean)) {
    return {
      valid: false,
      error: "Handle can only contain lowercase letters, numbers, and underscores.",
    };
  }
  if (rawClean.startsWith("_") || rawClean.endsWith("_")) {
    return { valid: false, error: "Handle cannot start or end with an underscore." };
  }
  if (rawClean.includes("__")) {
    return { valid: false, error: "Handle cannot contain consecutive underscores." };
  }
  if (RESERVED_HANDLES.has(rawClean)) {
    return { valid: false, error: "This handle is reserved by the system." };
  }

  return { valid: true, error: null };
}

/**
 * Sanitizes user display names.
 * Strips HTML, trims whitespace, limits length to 60 characters.
 */
export function sanitizeDisplayName(name: string): string {
  if (!name || typeof name !== "string") return "";
  return stripHtml(name).replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Sanitizes user biographies.
 * Strips HTML, normalizes consecutive blank lines, limits length to 240 characters.
 */
export function sanitizeBio(bio: string): string {
  if (!bio || typeof bio !== "string") return "";
  return stripHtml(bio)
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 240);
}

/**
 * Sanitizes city / location fields.
 * Strips HTML, trims whitespace, limits length to 80 characters.
 */
export function sanitizeCity(city: string): string {
  if (!city || typeof city !== "string") return "";
  return stripHtml(city).replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Sanitizes search queries to protect against SQL / PostgREST operator injection,
 * malicious wildcard attacks, and query bloating.
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== "string") return "";

  return (
    stripControlChars(query, false)
      // Strip HTML
      .replace(/<[^>]*>/g, "")
      // Strip PostgREST filter injection tokens
      .replace(/\b(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\./gi, "")
      .replace(/\b(or|and)\s*=\s*/gi, "")
      .replace(/[;%_\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100)
  );
}

/**
 * Sanitizes chat and direct message bodies.
 * Strips dangerous HTML tags while preserving line breaks and emoji, up to 5000 characters.
 */
export function sanitizeMessageBody(body: string): string {
  if (!body || typeof body !== "string") return "";
  return stripHtml(body)
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 5000);
}

/**
 * Validates and sanitizes asset/external URLs.
 * Rejects javascript:, data:, vbscript:, and file: schemes.
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  const trimmed = url.trim();
  if (trimmed.startsWith("/")) {
    // Relative path is allowed
    return trimmed.replace(/[<>"'`\s]/g, "");
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitizes community metadata before submission.
 */
export function sanitizeCommunityInput(data: {
  name: string;
  description: string;
  line?: string | undefined;
}): {
  name: string;
  description: string;
  line: string;
} {
  return {
    name: stripHtml(data.name).replace(/\s+/g, " ").trim().slice(0, 60),
    description: stripHtml(data.description).trim().slice(0, 1000),
    line: data.line ? stripHtml(data.line).trim().slice(0, 120) : "",
  };
}

/**
 * Sanitizes community post/thread content.
 */
export function sanitizeThreadInput(data: { title: string; content?: string | undefined }): {
  title: string;
  content: string;
} {
  return {
    title: stripHtml(data.title).replace(/\s+/g, " ").trim().slice(0, 200),
    content: data.content ? stripHtml(data.content).trim().slice(0, 5000) : "",
  };
}

/**
 * Sanitizes community reply text.
 */
export function sanitizeReplyInput(text: string): string {
  return stripHtml(text).trim().slice(0, 3000);
}

/**
 * Sanitizes safety report inputs.
 */
export function sanitizeReportInput(data: { reason: string; details?: string | undefined }): {
  reason: string;
  details: string;
} {
  return {
    reason: stripHtml(data.reason).replace(/\s+/g, " ").trim().slice(0, 100),
    details: data.details ? stripHtml(data.details).replace(/\s+/g, " ").trim().slice(0, 1000) : "",
  };
}
