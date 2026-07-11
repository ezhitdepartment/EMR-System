// TEMPORARY mock data — replace with real Supabase auth later.
// role determines redirect: every role except "admin" goes to /encounters
// (the staff dashboard), "admin" goes to /admin. See src/data/roles.js.
//
// firstName/lastName/prefix/licenseNumber/email are editable later via
// Account Settings (see AuthContext's updateProfile) — these are just
// starting defaults derived from `username`, not authoritative.

export const mockUsers = [
  {
    username: "Cliford Vincent C. Gamit",
    password: "202311187",
    role: "er_nurse",
    prefix: "",
    firstName: "Cliford Vincent",
    lastName: "Gamit",
    email: "cliford.gamit@ezaratehospital.ph",
    licenseNumber: "",
  },
  {
    username: "Edward Chee",
    password: "12345678",
    role: "opd_nurse",
    prefix: "",
    firstName: "Edward",
    lastName: "Chee",
    email: "edward.chee@ezaratehospital.ph",
    licenseNumber: "",
  },
  {
    username: "Admin",
    password: "Admin12345678",
    role: "admin",
    prefix: "",
    firstName: "Admin",
    lastName: "",
    email: "admin@ezaratehospital.ph",
    licenseNumber: "",
  },
  {
    username: "Marc Piton Ebreo",
    password: "12345678",
    role: "doctor",
    prefix: "Dr.",
    firstName: "Marc Piton",
    lastName: "Ebreo",
    email: "marc.ebreo@ezaratehospital.ph",
    licenseNumber: "",
  },
  {
    username: "Robeth Dimas",
    password: "12345678",
    role: "med_tech",
    prefix: "",
    firstName: "Robeth",
    lastName: "Dimas",
    email: "robeth.dimas@ezaratehospital.ph",
    licenseNumber: "",
  },
  {
    username: "Mark Van Josh",
    password: "12345678",
    role: "xray_tech",
    prefix: "",
    firstName: "Mark Van",
    lastName: "Josh",
    email: "mark.josh@ezaratehospital.ph",
    licenseNumber: "",
  },
];