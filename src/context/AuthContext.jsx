import { createContext, useContext, useState } from "react";
import { mockUsers } from "../data/mockUsers";

const AuthContext = createContext(null);

const SESSION_KEY = "ezarate_user";
// Keyed by username. Since mockUsers is just static seed data (not
// localStorage-backed), profile edits and password changes made through
// Account Settings are stored here instead, then merged over the seed
// record on every login so they survive logout/login for that account.
// Swap these for real Supabase `profiles`/auth updates later — every
// consumer of useAuth() (Topbar, AccountSettingsModal) keeps working
// unchanged.
const PROFILE_OVERRIDES_KEY = "ezarate_profile_overrides";
const PASSWORD_OVERRIDES_KEY = "ezarate_password_overrides";

function loadOverrides(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function currentPasswordFor(username) {
  const overrides = loadOverrides(PASSWORD_OVERRIDES_KEY);
  if (overrides[username]) return overrides[username];
  return mockUsers.find((u) => u.username === username)?.password;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  function login(username, password, role) {
    const found = mockUsers.find((u) => u.username === username);
    if (!found || password !== currentPasswordFor(username)) {
      return { success: false, error: "Invalid email or password." };
    }
    if (role && found.role !== role) {
      return {
        success: false,
        error: "This account isn't registered under the selected role.",
      };
    }

    const profileOverrides = loadOverrides(PROFILE_OVERRIDES_KEY)[username] || {};
    const sessionUser = {
      username: found.username,
      role: found.role,
      prefix: found.prefix || "",
      firstName: found.firstName || "",
      lastName: found.lastName || "",
      email: found.email || "",
      licenseNumber: found.licenseNumber || "",
      ...profileOverrides,
    };

    setUser(sessionUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    return { success: true, role: found.role };
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }

  // Personal Information tab in Account Settings.
  function updateProfile(updates) {
    if (!user) return { success: false, error: "Not logged in." };

    const nextUser = { ...user, ...updates };
    setUser(nextUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));

    const allOverrides = loadOverrides(PROFILE_OVERRIDES_KEY);
    allOverrides[user.username] = {
      ...allOverrides[user.username],
      ...updates,
    };
    localStorage.setItem(PROFILE_OVERRIDES_KEY, JSON.stringify(allOverrides));

    return { success: true };
  }

  // Security Information tab in Account Settings.
  function changePassword(oldPassword, newPassword) {
    if (!user) return { success: false, error: "Not logged in." };
    if (oldPassword !== currentPasswordFor(user.username)) {
      return { success: false, error: "Old password is incorrect." };
    }

    const allOverrides = loadOverrides(PASSWORD_OVERRIDES_KEY);
    allOverrides[user.username] = newPassword;
    localStorage.setItem(PASSWORD_OVERRIDES_KEY, JSON.stringify(allOverrides));

    return { success: true };
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}