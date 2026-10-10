import { getSignedInUser } from "../cloud/cloudSync";
import { supabase } from "../cloud/supabase";

export type Audience = "self" | "friends" | "public";
export interface SocialAuthor { userId: string; displayName: string; username: string | null; photoPath: string | null }
export interface SocialPost { id: string; userId: string; postType: string; audience: Audience; body: string | null; payload: Record<string, unknown>; reactionCount: number; commentCount: number; createdAt: string; author: SocialAuthor }
export interface Rugido { id: string; userId: string; type: string; audience: Audience; body: string | null; payload: Record<string, unknown>; expiresAt: string; viewed: boolean; viewCount: number; reactionCount: number; author: SocialAuthor }
export interface Challenge { id: string; creatorId: string; name: string; description: string | null; privacy: "private" | "friends" | "public"; state: string; startsAt: string; endsAt: string; metric?: string; pointsPerUnit?: number; joined: boolean }

async function requireCloudUser() {
  if (!supabase) throw new Error("A Comunidade precisa da nuvem configurada.");
  const user = await getSignedInUser();
  if (!user) throw new Error("Entre na sua conta para acessar a Comunidade dos Ursos.");
  return user;
}

async function authorsFor(ids: string[]) {
  if (!supabase || !ids.length) return new Map<string, SocialAuthor>();
  const { data, error } = await supabase.from("profiles").select("user_id,display_name,username,photo_path").in("user_id", [...new Set(ids)]);
  if (error) throw error;
  return new Map((data ?? []).map((profile) => [profile.user_id, { userId: profile.user_id, displayName: profile.display_name, username: profile.username, photoPath: profile.photo_path }]));
}

export async function listFeed(tab: "friends" | "explore" = "friends", cursor?: string, limit = 20) {
  const user = await requireCloudUser();
  let query = supabase!.from("social_posts").select("id,user_id,post_type,audience,body,published_payload,reaction_count,comment_count,created_at").is("removed_at", null).is("hidden_at", null).order("created_at", { ascending: false }).limit(limit);
  if (cursor) query = query.lt("created_at", cursor);
  if (tab === "friends") query = query.neq("audience", "public");
  const { data, error } = await query;
  if (error) throw error;
  const authors = await authorsFor((data ?? []).map((row) => row.user_id));
  return (data ?? []).map((row): SocialPost => ({ id: row.id, userId: row.user_id, postType: row.post_type, audience: row.audience, body: row.body, payload: row.published_payload ?? {}, reactionCount: row.reaction_count, commentCount: row.comment_count, createdAt: row.created_at, author: authors.get(row.user_id) ?? { userId: row.user_id, displayName: row.user_id === user.id ? "Você" : "Urso da comunidade", username: null, photoPath: null } }));
}

export async function createTextPost(body: string, audience: Audience, idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) {
  const user = await requireCloudUser();
  const value = body.trim(); if (!value) throw new Error("Escreva algo antes de publicar.");
  const { data, error } = await supabase!.from("social_posts").insert({ user_id: user.id, post_type: "text", audience, body: value, published_payload: {}, idempotency_key: idempotencyKey }).select("id").single();
  if (error) throw error;
  await supabase!.rpc("record_gamification_event", { event_key: `social_post_created:${data.id}`, event_name: "social_post_created", event_xp: 10, event_metadata: { post_id: data.id } });
  return data.id as string;
}

export async function togglePostReaction(postId: string, active: boolean) {
  const user = await requireCloudUser();
  const response = active ? await supabase!.from("post_reactions").upsert({ post_id: postId, user_id: user.id, reaction: "support" }) : await supabase!.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
  if (response.error) throw response.error;
}

export async function listFriendships() {
  const user = await requireCloudUser();
  const { data, error } = await supabase!.from("friendships").select("id,user_low_id,user_high_id,requested_by,status,created_at").or(`user_low_id.eq.${user.id},user_high_id.eq.${user.id}`).order("created_at", { ascending: false });
  if (error) throw error;
  const otherIds = (data ?? []).map((row) => row.user_low_id === user.id ? row.user_high_id : row.user_low_id);
  const authors = await authorsFor(otherIds);
  return (data ?? []).map((row, index) => ({ ...row, other: authors.get(otherIds[index]), incoming: row.requested_by !== user.id && row.status === "pending" }));
}

export async function requestFriendshipByUsername(username: string) {
  await requireCloudUser();
  const clean = username.trim().toLowerCase().replace(/^@/, "");
  const { data: profile, error } = await supabase!.from("profiles").select("user_id").eq("username", clean).maybeSingle();
  if (error) throw error; if (!profile) throw new Error("Não encontramos esse urso.");
  const { error: rpcError } = await supabase!.rpc("request_friendship", { target_user: profile.user_id }); if (rpcError) throw rpcError;
}

export async function respondFriendship(id: string, decision: "accepted" | "declined") { await requireCloudUser(); const { error } = await supabase!.rpc("respond_friendship", { friendship_id: id, decision }); if (error) throw error; }

export async function listRugidos() {
  const user = await requireCloudUser(); const now = new Date().toISOString();
  const { data, error } = await supabase!.from("rugidos").select("id,user_id,rugido_type,audience,body,published_payload,expires_at,view_count,reaction_count").gt("expires_at", now).is("deleted_at", null).order("created_at", { ascending: false }).limit(50);
  if (error) throw error; const ids = (data ?? []).map((row) => row.id);
  const [{ data: views }, authors] = await Promise.all([ids.length ? supabase!.from("rugido_views").select("rugido_id").eq("viewer_id", user.id).in("rugido_id", ids) : Promise.resolve({ data: [] }), authorsFor((data ?? []).map((row) => row.user_id))]);
  const viewed = new Set((views ?? []).map((row: { rugido_id: string }) => row.rugido_id));
  return (data ?? []).map((row): Rugido => ({ id: row.id, userId: row.user_id, type: row.rugido_type, audience: row.audience, body: row.body, payload: row.published_payload ?? {}, expiresAt: row.expires_at, viewed: viewed.has(row.id), viewCount: row.view_count, reactionCount: row.reaction_count, author: authors.get(row.user_id) ?? { userId: row.user_id, displayName: row.user_id === user.id ? "Você" : "Urso", username: null, photoPath: null } }));
}

export async function createTextRugido(body: string, audience: Audience) {
  const user = await requireCloudUser(); const value = body.trim(); if (!value) throw new Error("Escreva seu Rugido.");
  const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; const { data, error } = await supabase!.from("rugidos").insert({ user_id: user.id, rugido_type: "text", audience, body: value, background_key: "cave-lime", idempotency_key: idempotencyKey }).select("id").single();
  if (error) throw error; await supabase!.rpc("record_gamification_event", { event_key: `rugido_created:${data.id}`, event_name: "rugido_created", event_xp: 15, event_metadata: { rugido_id: data.id } }); return data.id as string;
}

export async function markRugidoViewed(id: string) { const user = await requireCloudUser(); const { error } = await supabase!.from("rugido_views").upsert({ rugido_id: id, viewer_id: user.id }); if (error) throw error; }

export async function listChallenges() {
  const user = await requireCloudUser();
  const { data, error } = await supabase!.from("challenges").select("id,creator_id,name,description,privacy,state,starts_at,ends_at,challenge_rules(metric,points_per_unit),challenge_members(user_id,status)").order("starts_at", { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []).map((row): Challenge => ({ id: row.id, creatorId: row.creator_id, name: row.name, description: row.description, privacy: row.privacy, state: row.state, startsAt: row.starts_at, endsAt: row.ends_at, metric: Array.isArray(row.challenge_rules) ? row.challenge_rules[0]?.metric : undefined, pointsPerUnit: Array.isArray(row.challenge_rules) ? row.challenge_rules[0]?.points_per_unit : undefined, joined: Array.isArray(row.challenge_members) && row.challenge_members.some((member: { user_id: string; status: string }) => member.user_id === user.id && member.status === "joined") }));
}

export async function createChallenge(input: { name: string; description?: string; startsAt: string; endsAt: string; privacy: "private" | "friends" | "public"; metric: string }) {
  const user = await requireCloudUser(); const { data, error } = await supabase!.from("challenges").insert({ creator_id: user.id, name: input.name.trim(), description: input.description?.trim() || null, kind: "friends", privacy: input.privacy, starts_at: input.startsAt, ends_at: input.endsAt, state: "enrollment" }).select("id").single();
  if (error) throw error; const { error: ruleError } = await supabase!.from("challenge_rules").insert({ challenge_id: data.id, metric: input.metric, points_per_unit: 1, proof_type: "ursofit_activity" }); if (ruleError) throw ruleError; return data.id as string;
}
export async function joinChallenge(id: string) { await requireCloudUser(); const { error } = await supabase!.rpc("join_challenge", { target_challenge: id }); if (error) throw error; }
