import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { STAFF_ROLES, hasFeatureAccess } from "../data/roles";
import Login from "../pages/auth/Login";
import AdminPage from "../pages/admin/AdminPage";
import DashboardLayout from "../components/layout/DashboardLayout";
import PatientRegistration from "../pages/patient/PatientRegistration";
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
import Masterlist from "../features/phc/Masterlist";
import YakapTracker from "../features/phc/YakapTracker";
import Users from "../features/admin/Users";
import Roles from "../features/admin/Roles";
import Medicines from "../features/admin/Medicines";
import AuditLogs from "../features/admin/AuditLogs";
import Settings from "../features/admin/Settings";

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Login page - always accessible */}
      <Route path="/" element={<Login />} />

      {/* Admin page - protected */}
      <Route
        path="/admin"
        element={user?.role === "admin" ? <PatientRegistration/> : <AdminPage />}
      />

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

      {/* Staff Dashboard - protected. Admin gets it too (in addition to its
          own /admin area above) so it sees everything, same as before
          role-based filtering existed. */}
      {(STAFF_ROLES.includes(user?.role) || user?.role === "admin") && (
        <Route element={<DashboardLayout />}>
          {/* "/patients" is the one feature every role in ROLE_FEATURE_ACCESS
              has, so it's the safe fallback wherever a role hits a route
              its dashboard doesn't include. */}
          <Route index element={<Navigate to="/patients" replace />} />

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
          <Route path="/phc/masterlist" element={<Masterlist />} />
          <Route path="/phc/yakap-tracker" element={<YakapTracker />} />

          <Route
            path="/admin/users"
            element={hasFeatureAccess(user?.role, "adminTools") ? <Users /> : <Navigate to="/patients" replace />}
          />
          <Route
            path="/admin/roles"
            element={hasFeatureAccess(user?.role, "adminTools") ? <Roles /> : <Navigate to="/patients" replace />}
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