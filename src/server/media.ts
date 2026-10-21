import { validateMediaFile, uploadToR2, isR2Configured, getR2Config } from "../lib/r2";

export async function handleMediaUpload(request: Request, env?: unknown): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Expected multipart/form-data with a 'file' field" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided in form data" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const validation = validateMediaFile({ size: file.size, type: file.type });
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const userId = (formData.get("userId") as string) || "user";
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 60);
    const key = `posts/${userId}/${Date.now()}-${sanitizedName}`;

    const arrayBuffer = await file.arrayBuffer();

    // Check if Cloudflare R2 is configured
    const r2Config = getR2Config(env);
    if (isR2Configured(r2Config)) {
      const uploadRes = await uploadToR2(key, arrayBuffer, file.type, r2Config);
      if (uploadRes.error) {
        console.error("[R2 Upload Error]:", uploadRes.error);
        return new Response(JSON.stringify({ error: uploadRes.error }), {
          status: 502,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          url: uploadRes.url,
          mediaType: validation.mediaType,
          size: file.size,
          storage: "cloudflare_r2",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }

    // Fallback: If R2 is not yet configured with secret keys in development,
    // convert small files or provide simulated storage URL so testing works seamlessly
    const missingKeys: string[] = [];
    if (!r2Config.accountId) missingKeys.push("CLOUDFLARE_ACCOUNT_ID");
    if (!r2Config.accessKeyId) missingKeys.push("CLOUDFLARE_R2_ACCESS_KEY_ID");
    if (!r2Config.secretAccessKey) missingKeys.push("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
    if (!r2Config.bucketName) missingKeys.push("CLOUDFLARE_R2_BUCKET_NAME");

    console.warn(`[Media Upload]: R2 credentials missing (${missingKeys.join(", ")}). Using local dev storage fallback.`);

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return new Response(
      JSON.stringify({
        url: dataUrl,
        mediaType: validation.mediaType,
        size: file.size,
        storage: "dev_fallback",
        notice: `Stored using dev fallback. Missing credentials: ${missingKeys.join(", ")}`,
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal upload error" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
