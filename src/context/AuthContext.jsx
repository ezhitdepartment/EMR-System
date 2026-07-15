import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { recordLogin } from "../utils/auditLogs";
import { ONLINE_PRESENCE_CHANNEL } from "../lib/presence";

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
    status: row.status || "active",
    photo: row.photo || "",
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
  // Who's currently online, read from the same presence channel this tab
  // tracks itself on — kept here (not in Roles.jsx) because a Realtime
  // channel can only be subscribed to once; a second `supabase.channel()`
  // call with the same name elsewhere returns that same already-subscribed
  // channel, and attaching a new listener to it after subscribe() throws.
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());

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

  // "Online" in the Roles table comes from Realtime Presence, not a
  // stored column — as long as this tab has a logged-in session open, it
  // marks itself present on a shared channel; closing the tab / losing
  // connection lets it drop off automatically (no explicit "sign off"
  // step needed).
  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      return;
    }

    const channel = supabase.channel(ONLINE_PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });

    // Listeners must be attached BEFORE subscribe() — Realtime rejects
    // adding them afterward.
    channel.on("presence", { event: "sync" }, () => {
      setOnlineUserIds(new Set(Object.keys(channel.presenceState())));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
      // Supabase Auth rejects a banned/suspended account's sign-in with a
      // message that mentions "banned" — surface that as a clear reason
      // instead of the generic invalid-credentials message.
      if (error.message?.toLowerCase().includes("banned")) {
        return { success: false, error: "This account has been suspended. Contact an admin." };
      }
      return { success: false, error: "Invalid username or password." };
    }

    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { success: false, error: "Account has no profile set up. Contact an admin." };
    }
    if (profile.status === "suspended") {
      await supabase.auth.signOut();
      return { success: false, error: "This account has been suspended. Contact an admin." };
    }
    if (role && profile.role !== role) {
      await supabase.auth.signOut();
      return { success: false, error: "This account isn't registered under the selected role." };
    }

    setUser(profile);
    recordLogin(profile); // fire-and-forget — never block a login on this
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
    <AuthContext.Provider
      value={{ user, loading, onlineUserIds, login, logout, updateProfile, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}