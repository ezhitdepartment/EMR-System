// Tiny shared constant so AuthContext (which tracks "I'm online") and the
// Roles page (which reads who's currently online) always agree on which
// Realtime channel they mean.
export const ONLINE_PRESENCE_CHANNEL = "online-users";
