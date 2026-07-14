// Admin-only user management — calls the "admin-create-user" Edge Function
// (supabase/functions/admin-create-user) rather than talking to Supabase
// Auth directly, since creating an account requires the project's
// service_role key, which must never be shipped in frontend code.

import { supabase } from "../lib/supabaseClient";

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
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: { email, password, username, role, prefix, firstName, lastName, licenseNumber },
  });

  if (error) {
    // supabase-js wraps a non-2xx response in a generic error — try to
    // pull the actual message the function sent back, since that's the
    // one worth showing the admin.
    let message = error.message;
    try {
      const body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      // fall back to the generic message above
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data.user;
}
