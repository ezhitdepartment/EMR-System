// Audit Logs data layer — currently just login events (who logged in and
// when), backed by the `login_events` table (see supabase_schema.sql
// addendum). Same rowTo*/insert pattern as utils/patients.js: Postgres
// columns are snake_case, everything the rest of the app touches is
// camelCase, and this file is the only place that translates between them.

import { supabase } from "../lib/supabaseClient";

function rowToLoginEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    prefix: row.prefix || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    email: row.email || "",
    licenseNumber: row.license_number || "",
    loggedInAt: row.logged_in_at,
  };
}

export async function loadLoginHistory() {
  const { data, error } = await supabase
    .from("login_events")
    .select("*")
    .order("logged_in_at", { ascending: false });
  if (error) {
    console.error("loadLoginHistory failed:", error.message);
    return [];
  }
  return (data || []).map(rowToLoginEvent);
}

// Called from AuthContext.login() right after a successful sign-in.
// sessionUser is the same camelCase profile object AuthContext stores for
// the session, so this always reflects whatever name/role/license/email
// that account had at the moment they logged in. Fire-and-forget by
// design — a failed audit-trail write should never block someone's login.
export async function recordLogin(sessionUser) {
  const { error } = await supabase.from("login_events").insert({
    user_id: sessionUser.id,
    username: sessionUser.username,
    role: sessionUser.role,
    prefix: sessionUser.prefix || "",
    first_name: sessionUser.firstName || "",
    last_name: sessionUser.lastName || "",
    email: sessionUser.email || "",
    license_number: sessionUser.licenseNumber || "",
  });
  if (error) {
    console.error("recordLogin failed:", error.message);
  }
}
