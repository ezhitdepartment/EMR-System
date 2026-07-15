// Admin-only user management — most of this calls dedicated Edge
// Functions (see supabase/functions/admin-*) rather than talking to
// Supabase Auth directly, since creating/suspending/deleting an account
// or resetting its password all require the project's service_role key,
// which must never be shipped in frontend code.

import { supabase } from "../lib/supabaseClient";

async function invoke(functionName, body) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    // supabase-js wraps a non-2xx response in a generic error — try to
    // pull the actual message the function sent back, since that's the
    // one worth showing the admin.
    let message = error.message;
    try {
      const parsed = await error.context?.json();
      if (parsed?.error) message = parsed.error;
    } catch {
      // fall back to the generic message above
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Creates a new staff login with whatever role the admin picks. Throws
// with a human-readable message on failure (missing fields, duplicate
// email, caller isn't actually an admin, etc.) — callers should catch and
// display err.message.
export async function createStaffAccount({
  email,
  password,
  username,
  role,
  prefix,
  firstName,
  lastName,
  licenseNumber,
}) {
  const data = await invoke("admin-create-user", {
    email,
    password,
    username,
    role,
    prefix,
    firstName,
    lastName,
    licenseNumber,
  });
  return data.user;
}

// Suspends (or un-suspends) an account — blocks/unblocks sign-in at the
// Auth level, not just cosmetically.
export async function setAccountSuspension(targetUserId, suspend) {
  const data = await invoke("admin-set-suspension", { targetUserId, suspend });
  return data.status; // "active" | "suspended"
}

// Resets the account's password back to whatever it was set to when the
// admin created it.
export async function resetToOriginalPassword(targetUserId) {
  await invoke("admin-reset-password", { targetUserId });
}

// Permanently deletes an account. Requires the CALLING admin's own
// username + password as a step-up confirmation (verified server-side —
// see admin-delete-account).
export async function deleteAccount({ targetUserId, adminUsername, adminPassword }) {
  await invoke("admin-delete-account", { targetUserId, adminUsername, adminPassword });
}

// Fetches one user's profile row as-is (snake_case) — used by the user
// profile page. Admins can read any profile (see the "profiles: read
// all" RLS policy), so this is a plain client-side select, no Edge
// Function needed.
export async function getUserById(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data;
}

// Saves a new profile photo (base64 data URL) — stored the same way
// patient photos are, directly in the column, for consistency with the
// rest of the app.
export async function saveUserPhoto(userId, photoDataUrl) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ photo: photoDataUrl })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Activity summary for the user profile page: how many patients they
// registered, and how many consultation entries they've authored (plus
// how many distinct patients those consultations touched).
export async function getUserActivityStats(userId) {
  const [patientsCreated, consultationsAuthored, distinctPatients] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("created_by", userId),
    supabase
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    supabase.from("consultations").select("patient_id").eq("author_id", userId),
  ]);

  const uniquePatientIds = new Set((distinctPatients.data || []).map((r) => r.patient_id));

  return {
    patientsCreated: patientsCreated.count || 0,
    consultationsAuthored: consultationsAuthored.count || 0,
    patientsConsulted: uniquePatientIds.size,
  };
}
