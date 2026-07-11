// Single source of truth for the sidebar. Add a new page by adding one
// entry here plus the route in App.jsx — the sidebar updates automatically.
// `feature` maps each item to the access list in data/roles.js — that's
// what actually decides who sees it; this file is just labels/paths/icons.
export const navGroups = [
  {
    label: "Main",
    items: [
      { label: "Registration", path: "/encounters", icon: "Stethoscope", feature: "registration" },
      { label: "Patients", path: "/patients", icon: "Users", feature: "patients" },
      { label: "Lab Orders", path: "/lab-orders", icon: "FlaskConical", feature: "labOrders" },
      {
        label: "Medicine Prescriptions",
        path: "/medicine-prescriptions",
        icon: "Pill",
        feature: "medicinePrescriptions",
      },
      { label: "Reports", path: "/reports", icon: "FileBarChart2", feature: "reports" },
    ],
  },
  {
    label: "PHC",
    items: [
      { label: "Masterlist", path: "/phc/masterlist", icon: "ClipboardList", feature: "masterlist" },
      { label: "Yakap Tracker", path: "/phc/yakap-tracker", icon: "HeartPulse", feature: "yakapTracker" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Users", path: "/admin/users", icon: "UserCog", feature: "adminTools" },
      { label: "Roles", path: "/admin/roles", icon: "ShieldCheck", feature: "adminTools" },
      { label: "Medicines", path: "/admin/medicines", icon: "Package2", feature: "adminTools" },
      { label: "Audit Logs", path: "/admin/audit-logs", icon: "History", feature: "adminTools" },
      { label: "Settings", path: "/admin/settings", icon: "Settings", feature: "adminTools" },
    ],
  },
];