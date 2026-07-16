// Notifications data layer. Notification rows themselves are entirely
// server-generated (see the trigger functions in the notifications SQL
// addendum) — this file only ever reads them plus each user's own
// per-notification read state, and writes to notification_reads to mark
// things read. There's no create/update/delete for the notifications
// table itself here on purpose: RLS only grants SELECT on it from the
// client, matching that these rows only ever come from the DB triggers.

import { supabase } from "../lib/supabaseClient";

function rowToNotification(row, readIds) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedType: row.related_type,
    relatedId: row.related_id,
    createdAt: row.created_at,
    read: readIds.has(row.id),
  };
}

// Every notification aimed at the current user's role, newest first, with
// per-user read state merged in. RLS on `notifications` already scopes
// this to rows where current_user_role() is one of that row's
// target_roles — nothing to filter client-side.
export async function loadNotifications(userId, limit = 100) {
  const { data: notifRows, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("loadNotifications failed:", error.message);
    return [];
  }

  const { data: readRows, error: readError } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId);
  if (readError) console.error("loadNotifications (reads) failed:", readError.message);

  const readIds = new Set((readRows || []).map((r) => r.notification_id));
  return (notifRows || []).map((row) => rowToNotification(row, readIds));
}

export async function markAsRead(notificationId, userId) {
  const { error } = await supabase
    .from("notification_reads")
    .upsert(
      { notification_id: notificationId, user_id: userId },
      { onConflict: "notification_id,user_id" }
    );
  if (error) console.error("markAsRead failed:", error.message);
}

export async function markAllAsRead(notifications, userId) {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const rows = unread.map((n) => ({ notification_id: n.id, user_id: userId }));
  const { error } = await supabase
    .from("notification_reads")
    .upsert(rows, { onConflict: "notification_id,user_id" });
  if (error) console.error("markAllAsRead failed:", error.message);
}

// Where clicking a notification should take you.
export function notificationLink(n) {
  switch (n.relatedType) {
    case "patient":
      return `/patients/${n.relatedId}`;
    case "encounter":
      return `/encounters`;
    case "lab_order":
      return `/lab-orders/${n.relatedId}`;
    default:
      return null;
  }
}

// "2026-07-06T09:15:00.000Z" -> "5 min ago" / "2 hr ago" / "07/06/2026"
export function formatRelativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const dt = new Date(iso);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${m}/${d}/${dt.getFullYear()}`;
}
