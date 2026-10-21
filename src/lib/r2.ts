/**
 * ============================================================================
 * CLOUDFLARE R2 ZERO-EGRESS MEDIA STORAGE CLIENT
 * ============================================================================
 * Lightweight S3-compatible client for Cloudflare R2 using standard Web Crypto
 * APIs. Works uniformly across Node, Vite SSR, Cloudflare Workers & Nitro.
 */

export type R2Config = {
  accountId?: string | undefined;
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  bucketName?: string | undefined;
  publicUrl?: string | undefined;
};

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export function isAllowedMediaType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(mimeType) || ALLOWED_VIDEO_TYPES.has(mimeType);
}

export function validateMediaFile(file: { size: number; type: string }): {
  valid: boolean;
  error?: string;
  mediaType: "image" | "video";
} {
  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type || "unknown"}. Only JPG, PNG, WebP, GIF, MP4, and WebM are permitted.`,
      mediaType: "image",
    };
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Image exceeds maximum permitted size of 10MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      mediaType: "image",
    };
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      error: `Video exceeds maximum permitted size of 50MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      mediaType: "video",
    };
  }

  return {
    valid: true,
    mediaType: isVideo ? "video" : "image",
  };
}

/**
 * Gets R2 configuration from process.env or import.meta.env
 */
export function getR2Config(): R2Config {
  const env =
    typeof process !== "undefined" && process.env
      ? process.env
      : typeof import.meta !== "undefined" && import.meta.env
        ? (import.meta.env as Record<string, string | undefined>)
        : {};

  return {
    accountId: env["R2_ACCOUNT_ID"] || env["CLOUDFLARE_R2_ACCOUNT_ID"],
    accessKeyId: env["R2_ACCESS_KEY_ID"] || env["CLOUDFLARE_R2_ACCESS_KEY_ID"],
    secretAccessKey: env["R2_SECRET_ACCESS_KEY"] || env["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
    bucketName: env["R2_BUCKET_NAME"] || env["CLOUDFLARE_R2_BUCKET"] || "cesium-media",
    publicUrl:
      env["R2_PUBLIC_URL"] ||
      env["CLOUDFLARE_R2_PUBLIC_URL"] ||
      (env["R2_ACCOUNT_ID"] ? `https://${env["R2_BUCKET_NAME"] || "cesium-media"}.${env["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com` : undefined),
  };
}

export function isR2Configured(cfg = getR2Config()): boolean {
  return Boolean(cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucketName);
}

// Minimal SigV4 HMAC-SHA256 helpers using native Web Crypto API
async function sha256(data: Uint8Array | string): Promise<string> {
  const raw = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", raw as BufferSource);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: Uint8Array | ArrayBuffer, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

/**
 * Uploads media buffer directly to Cloudflare R2 via S3-compatible REST API
 */
export async function uploadToR2(
  key: string,
  data: Uint8Array | ArrayBuffer,
  contentType: string,
  cfg = getR2Config(),
): Promise<{ url: string; error?: string }> {
  if (!isR2Configured(cfg)) {
    return {
      url: "",
      error: "Cloudflare R2 is not fully configured with Account ID, Access Key, and Secret.",
    };
  }

  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";

    const host = `${cfg.bucketName}.${cfg.accountId}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}/${key}`;
    const payloadHash = await sha256(bytes);

    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest =
      `PUT\n` +
      `/${key}\n` +
      `\n` +
      canonicalHeaders +
      `\n` +
      signedHeaders +
      `\n` +
      payloadHash;

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign =
      `AWS4-HMAC-SHA256\n` +
      `${amzDate}\n` +
      `${credentialScope}\n` +
      (await sha256(canonicalRequest));

    // Derive SigV4 signing key
    const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${cfg.secretAccessKey}`), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, "aws4_request");
    const signatureBytes = await hmacSha256(kSigning, stringToSign);
    const signature = Array.from(signatureBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const authorizationHeader =
      `AWS4-HMAC-SHA256 ` +
      `Credential=${cfg.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`;

    const res = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "content-type": contentType,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Authorization: authorizationHeader,
      },
      body: bytes as BodyInit,
    });

    if (!res.ok) {
      const errText = await res.text();
      return { url: "", error: `Cloudflare R2 rejected upload (${res.status}): ${errText}` };
    }

    const publicBase = cfg.publicUrl ? cfg.publicUrl.replace(/\/+$/, "") : `https://${host}`;
    return { url: `${publicBase}/${key}` };
  } catch (err) {
    return { url: "", error: err instanceof Error ? err.message : String(err) };
  }
}
