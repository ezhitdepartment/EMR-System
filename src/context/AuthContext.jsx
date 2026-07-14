import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

// Converts a `profiles` table row (snake_case, matches the SQL schema) into
// the camelCase `user` shape every consumer of useAuth() already expects
// (Topbar, Sidebar, AccountSettingsModal, role checks throughout the app).
// Keeping this mapping in one place is what let the Supabase Auth rewrite
// land without touching any of those ~15 consumer files.
function profileRowToUser(row) {
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
  };
}

async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return profileRowToUser(data);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Distinguishes "still checking for an existing session" from "checked,
  // nobody's logged in" — AppRoutes.jsx should show a loading state instead
  // of bouncing to /login for a split second on every page refresh.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Restore an existing session on page load/refresh.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (active) setUser(profile);
      }
      if (active) setLoading(false);
    });

    // Keep `user` in sync with sign-in/sign-out/token-refresh events,
    // including ones triggered from another tab.
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (active) setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function login(username, password, role) {
    // Look up the email for this username first, since Supabase Auth signs
    // in with email/password, not username — see supabase_auth_lookup.sql.
    const { data: email, error: lookupError } = await supabase.rpc("get_email_for_username", {
      lookup_username: username,
    });
    if (lookupError || !email) {
      return { success: false, error: "Invalid username or password." };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: "Invalid username or password." };
    }

    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { success: false, error: "Account has no profile set up. Contact an admin." };
    }
    if (role && profile.role !== role) {
      await supabase.auth.signOut();
      return { success: false, error: "This account isn't registered under the selected role." };
    }

    setUser(profile);
    return { success: true, role: profile.role };
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  // Personal Information tab in Account Settings.
  async function updateProfile(updates) {
    if (!user) return { success: false, error: "Not logged in." };

    const { error } = await supabase
      .from("profiles")
      .update({
        prefix: updates.prefix,
        first_name: updates.firstName,
        last_name: updates.lastName,
        license_number: updates.licenseNumber,
      })
      .eq("id", user.id);

    if (error) return { success: false, error: error.message };

    setUser((u) => ({ ...u, ...updates }));
    return { success: true };
  }

  // Security Information tab in Account Settings. Supabase Auth's
  // updateUser() trusts the current session and doesn't ask for the old
  // password itself, so we re-verify it by attempting a fresh sign-in
  // first — same "old password must be correct" guarantee the old mock
  // version had.
  async function changePassword(oldPassword, newPassword) {
    if (!user) return { success: false, error: "Not logged in." };

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });
    if (verifyError) {
      return { success: false, error: "Old password is incorrect." };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };

    return { success: true };
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}