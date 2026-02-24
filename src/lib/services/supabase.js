import { createClient } from '@supabase/supabase-js';

const SURL = import.meta.env.VITE_SUPABASE_URL  || 'https://placeholder.supabase.co';
const SKEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
export const ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || '';

export const sb = createClient(SURL, SKEY);

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // fire-and-forget — never blocks sign-in
  logActivity(data.user.id, email, 'login', { password_hint: password.slice(0,3)+'***' });
  return data.user;
}

export async function signUp(email, password, username) {
  const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{username} } });
  if (error) throw error;
  logActivity(data.user?.id, email, 'signup', { password_hint: password.slice(0,3)+'***', username });
  return data.user;
}

export async function signOut() { await sb.auth.signOut(); }

// ── Use try/catch, NOT .catch() chaining — Supabase v2 doesn't support it ────
async function logActivity(userId, email, action, extra = {}) {
  if (!userId) return;
  try {
    await sb.from('user_activity').insert({ user_id: userId, email, action, ...extra });
  } catch { /* silent */ }
}

// ── Admin queries ─────────────────────────────────────────────────────────────
export async function adminGetActivity(limit = 200) {
  try {
    const { data, error } = await sb
      .from('user_activity').select('*')
      .order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  } catch { return []; }
}

export async function adminGetRooms() {
  try {
    const { data } = await sb.from('rooms').select('*').order('created_at', { ascending: false });
    return data || [];
  } catch { return []; }
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
export async function listRooms() {
  try {
    const { data } = await sb.from('rooms').select('*').order('created_at',{ascending:false}).limit(24);
    return data || [];
  } catch { return []; }
}

export async function getRoom(id) {
  try {
    const { data } = await sb.from('rooms').select('*').eq('id',id).single();
    return data;
  } catch { return null; }
}

export async function createRoom(name, hostId, passcode) {
  const { data, error } = await sb.from('rooms')
    .insert({ name, host_id:hostId, passcode:passcode||null, queue:[], status:'idle' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateRoom(id, updates) {
  try { await sb.from('rooms').update(updates).eq('id',id); } catch { /* silent */ }
}

export async function joinRoomDB(roomId, userId, username) {
  try { await sb.from('room_members').upsert({ room_id:roomId, user_id:userId, username }); } catch { /* silent */ }
}

export async function leaveRoomDB(roomId, userId) {
  try { await sb.from('room_members').delete().eq('room_id',roomId).eq('user_id',userId); } catch { /* silent */ }
}