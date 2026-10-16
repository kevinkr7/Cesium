import { getSupabase } from "@/lib/supabase/client";
import { interestCategories } from "@/lib/data";

export type Interest = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string | null;
};

export async function fetchAllInterests(): Promise<Record<string, string[]>> {
  const sb = getSupabase();
  if (!sb) {
    return interestCategories;
  }

  const { data, error } = await sb.from("interests").select("name, category").order("name");
  if (error || !data || data.length === 0) {
    return interestCategories;
  }

  const grouped: Record<string, string[]> = {};
  for (const item of data) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category]!.push(item.name);
  }
  return grouped;
}

export async function saveUserInterests(
  userId: string,
  standardInterests: string[],
  nicheInterests: string[],
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  // Clear existing
  const { error: delError } = await sb.from("user_interests").delete().eq("user_id", userId);
  if (delError) return { success: false, error: delError.message };

  const allNames = [
    ...standardInterests.map((n) => ({ name: n, isNiche: false })),
    ...nicheInterests.map((n) => ({ name: n, isNiche: true })),
  ];

  if (allNames.length === 0) return { success: true, error: null };

  for (const item of allNames) {
    const slug = item.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check or insert interest
    let { data: interest } = await sb.from("interests").select("id").eq("slug", slug).maybeSingle();
    if (!interest) {
      const { data: newInterest, error: insertError } = await sb
        .from("interests")
        .insert({
          slug,
          name: item.name.trim(),
          category: item.isNiche ? "Unusual obsessions" : "Curated",
          created_by: userId,
        })
        .select("id")
        .single();

      if (!insertError && newInterest) interest = newInterest;
    }

    if (interest) {
      await sb.from("user_interests").insert({
        user_id: userId,
        interest_id: interest.id,
        is_primary: !item.isNiche,
        is_niche: item.isNiche,
      });
    }
  }

  return { success: true, error: null };
}

export async function fetchUserInterests(
  userId: string,
): Promise<{ standard: string[]; niche: string[] }> {
  const sb = getSupabase();
  if (!sb) return { standard: [], niche: [] };

  const { data, error } = await sb
    .from("user_interests")
    .select("is_niche, interests(name)")
    .eq("user_id", userId);

  if (error || !data) return { standard: [], niche: [] };

  const standard: string[] = [];
  const niche: string[] = [];

  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (row.interests as any)?.name;
    if (!name) continue;
    if (row.is_niche) niche.push(name);
    else standard.push(name);
  }

  return { standard, niche };
}
