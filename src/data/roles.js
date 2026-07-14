// Single source of truth for the app's roles — Login.jsx uses ROLE_OPTIONS
// for the role selector, AppRoutes.jsx uses STAFF_ROLES to decide who gets
// the staff dashboard. Add a role here once and both places pick it up.

export const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "er_nurse", label: "ER Nurse" },
  { value: "opd_nurse", label: "OPD Nurse" },
  { value: "med_tech", label: "Med Tech" },
  { value: "xray_tech", label: "X-ray Tech" },
];

// Every role except "admin" is a staff-dashboard role — used by AppRoutes.jsx
// to decide who gets the dashboard at all (before ROLE_FEATURE_ACCESS below
// decides *which parts* of it they see). Admin gets the dashboard too (see
// AppRoutes.jsx), just via its own check since it also keeps its separate
// /admin area.
export const STAFF_ROLES = ["doctor", "er_nurse", "opd_nurse", "med_tech", "xray_tech"];

// Which dashboard features (see the `feature` key on each item in
// data/navigation.js) each role can see/reach. "all" means unrestricted —
// currently only Admin. Add a new role's dashboard access here; Sidebar.jsx
// and AppRoutes.jsx both read from this so they can't drift apart.
export const ROLE_FEATURE_ACCESS = {
  admin: "all",
  er_nurse: ["registration", "patients", "labOrders", "reports", "masterlist", "archive"],
  opd_nurse: ["registration", "patients", "labOrders", "reports", "masterlist", "archive"],
  doctor: ["registration", "patients", "medicinePrescriptions", "reports", "masterlist", "archive"],
  med_tech: ["patients", "labOrders", "reports", "masterlist", "archive"],
  xray_tech: ["patients", "labOrders", "reports", "masterlist", "archive"],
};

// Explicit exceptions layered on top of ROLE_FEATURE_ACCESS above. Admin's
// "all" access is intentionally broad — new features show up for admin
// automatically without needing to be listed — so this is only for the rare
// case where a role should NOT see a feature despite otherwise having
// broad/full access to everything else. Yakap Tracker is retired for every
// role (see ROLE_FEATURE_ACCESS above); admin needs the explicit denial
// here too since "all" would otherwise still grant it.
const ROLE_FEATURE_DENYLIST = {
  admin: ["yakapTracker"],
};

export function hasFeatureAccess(role, feature) {
  if (ROLE_FEATURE_DENYLIST[role]?.includes(feature)) return false;
  const allowed = ROLE_FEATURE_ACCESS[role];
  if (allowed === "all") return true;
  return Array.isArray(allowed) && allowed.includes(feature);
}