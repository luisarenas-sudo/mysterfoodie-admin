import { getSupabaseServiceClient } from "./supabase";

export type ClientSummary = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  lastScore: number | null;
};

export async function getClientsSummary(): Promise<ClientSummary[]> {
  const db = getSupabaseServiceClient();

  const { data: clients, error: clientsError } = await db
    .from("clients")
    .select("id, name, type, city");
  if (clientsError || !clients) return [];

  const { data: forms } = await db
    .from("forms")
    .select("client_id, overall_score, created_at")
    .order("created_at", { ascending: false });

  return clients
    .map((client) => {
      const clientForms = (forms || []).filter((f) => f.client_id === client.id);
      const last = clientForms[0];
      return {
        id: client.id,
        name: client.name,
        type: client.type,
        city: client.city,
        visitCount: clientForms.length,
        lastVisitAt: last?.created_at ?? null,
        lastScore: last?.overall_score ?? null,
      };
    })
    .sort((a, b) => {
      if (!a.lastVisitAt) return 1;
      if (!b.lastVisitAt) return -1;
      return new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime();
    });
}

export type VisitDetail = {
  id: string;
  shortCode: string;
  shopperName: string | null;
  overallScore: number;
  createdAt: string;
  ratings: { key: string; label: string; score: number }[];
};

export type ClientDetail = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  instagramHandle: string | null;
  visits: VisitDetail[];
};

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const db = getSupabaseServiceClient();

  const { data: client } = await db
    .from("clients")
    .select("id, name, type, city, instagram_handle")
    .eq("id", id)
    .maybeSingle();
  if (!client) return null;

  const { data: forms } = await db
    .from("forms")
    .select("id, short_code, shopper_name, overall_score, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: true });

  const { data: allRatings } = await db
    .from("form_ratings")
    .select("form_id, category_key, category_label, score")
    .in("form_id", (forms || []).map((f) => f.id));

  const visits: VisitDetail[] = (forms || []).map((f) => ({
    id: f.id,
    shortCode: f.short_code,
    shopperName: f.shopper_name,
    overallScore: f.overall_score,
    createdAt: f.created_at,
    ratings: (allRatings || [])
      .filter((r) => r.form_id === f.id)
      .map((r) => ({ key: r.category_key, label: r.category_label, score: r.score })),
  }));

  return {
    id: client.id,
    name: client.name,
    type: client.type,
    city: client.city,
    instagramHandle: client.instagram_handle,
    visits,
  };
}
