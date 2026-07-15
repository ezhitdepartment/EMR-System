import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { STAFF_ROLES, hasFeatureAccess } from "../data/roles";
import Login from "../pages/auth/Login";
import Dashboard from "../pages/admin/Dashboard";
import DashboardLayout from "../components/layout/DashboardLayout";
import PatientProfile from "../pages/patient/PatientProfile";
import Encounters from "../features/encounters/Encounters";
import CreateEncounterPage from "../features/encounters/CreateEncounterPage";
import TriagePage from "../features/encounters/TriagePage";
import EncounterFilesPage from "../features/encounters/EncounterFilesPage";
import Patients from "../features/patients/Patients";
import LabOrders from "../features/lab-orders/LabOrders";
import ViewLabOrderPage from "../features/lab-orders/ViewLabOrderPage";
import LabQueuePage from "../features/lab-orders/LabQueuePage";
import MedicinePrescriptions from "../features/medicine-prescriptions/MedicinePrescriptions";
import AddMedicinePrescriptionPage from "../features/medicine-prescriptions/AddMedicinePrescriptionPage";
import Reports from "../features/reports/Reports";
import Archive from "../features/archive/Archive";
import Masterlist from "../features/phc/Masterlist";
import YakapTracker from "../features/phc/YakapTracker";
import Users from "../features/admin/Users";
import Roles from "../features/admin/Roles";
import UserProfilePage from "../features/admin/UserProfilePage";
import UserAuditLogPage from "../features/admin/UserAuditLogPage";
import Medicines from "../features/admin/Medicines";
import AuditLogs from "../features/admin/AuditLogs";
import Settings from "../features/admin/Settings";

export default function AppRoutes() {
  const { user, loading } = useAuth();

  // Still checking for an existing Supabase session (page refresh, first
  // load) — don't make any redirect decisions yet, or a logged-in user
  // briefly gets bounced to /login every time they refresh the page.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Login page - always accessible */}
      <Route path="/" element={<Login />} />

      {/* Patient Profile - standalone, no dashboard chrome. The only way
          back is the "Back to Patients" button inside the page itself. */}
      <Route
        path="/patients/:patientId"
        element={
          STAFF_ROLES.includes(user?.role) || user?.role === "admin" ? (
            <PatientProfile />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Staff Dashboard - protected. Admin gets it too, plus its own
          "/admin" landing page (Dashboard) inside this same layout below. */}
      {(STAFF_ROLES.includes(user?.role) || user?.role === "admin") && (
        <Route element={<DashboardLayout />}>
          {/* "/patients" is the one feature every role in ROLE_FEATURE_ACCESS
              has, so it's the safe fallback wherever a role hits a route
              its dashboard doesn't include. */}
          <Route index element={<Navigate to="/patients" replace />} />

          <Route
            path="/admin"
            element={hasFeatureAccess(user?.role, "adminDashboard") ? <Dashboard /> : <Navigate to="/patients" replace />}
          />

          <Route
            path="/encounters"
            element={hasFeatureAccess(user?.role, "registration") ? <Encounters /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/encounters/create"
            element={
              hasFeatureAccess(user?.role, "registration") ? (
                <CreateEncounterPage />
              ) : (
                <Navigate to="/patients" replace />
              )
            }
          />
          <Route
            path="/encounters/:encounterId/triage"
            element={
              hasFeatureAccess(user?.role, "registration") ? <TriagePage /> : <Navigate to="/patients" replace />
            }
          />
          <Route
            path="/encounters/:encounterId/files"
            element={
              hasFeatureAccess(user?.role, "registration") ? (
                <EncounterFilesPage />
              ) : (
                <Navigate to="/patients" replace />
              )
            }
          />

          <Route path="/patients" element={<Patients />} />

          <Route
            path="/lab-orders"
            element={hasFeatureAccess(user?.role, "labOrders") ? <LabOrders /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/lab-orders/queue"
            element={hasFeatureAccess(user?.role, "labOrders") ? <LabQueuePage /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/lab-orders/:orderId"
            element={
              hasFeatureAccess(user?.role, "labOrders") ? <ViewLabOrderPage /> : <Navigate to="/patients" replace />
            }
          />

          <Route
            path="/medicine-prescriptions"
            element={
              hasFeatureAccess(user?.role, "medicinePrescriptions") ? (
                <MedicinePrescriptions />
              ) : (
                <Navigate to="/patients" replace />
              )
            }
          />
          <Route
            path="/medicine-prescriptions/create"
            element={
              hasFeatureAccess(user?.role, "medicinePrescriptions") ? (
                <AddMedicinePrescriptionPage />
              ) : (
                <Navigate to="/patients" replace />
              )
            }
          />

          <Route path="/reports" element={<Reports />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/phc/masterlist" element={<Masterlist />} />
          <Route
            path="/phc/yakap-tracker"
            element={hasFeatureAccess(user?.role, "yakapTracker") ? <YakapTracker /> : <Navigate to="/patients" replace />}
          />

          <Route
            path="/admin/users"
            element={hasFeatureAccess(user?.role, "adminTools") ? <Users /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/admin/roles"
            element={hasFeatureAccess(user?.role, "adminTools") ? <Roles /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/admin/roles/:userId"
            element={hasFeatureAccess(user?.role, "adminTools") ? <UserProfilePage /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/admin/roles/:userId/audit-log"
            element={hasFeatureAccess(user?.role, "adminTools") ? <UserAuditLogPage /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/admin/medicines"
            element={hasFeatureAccess(user?.role, "adminTools") ? <Medicines /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/admin/audit-logs"
            element={hasFeatureAccess(user?.role, "adminTools") ? <AuditLogs /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/admin/settings"
            element={hasFeatureAccess(user?.role, "adminTools") ? <Settings /> : <Navigate to="/patients" replace />}
          />
        </Route>
      )}

      {/* Catch-all - redirect to login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}