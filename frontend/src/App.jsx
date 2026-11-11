import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import HomeRedirect from './components/HomeRedirect'
import { MODULES } from './data/modules'
import Skeleton from './components/ui/Skeleton'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'))
const ModulePage = lazy(() => import('./pages/ModulePage'))
const RegistrationPage = lazy(() => import('./pages/patients/RegistrationPage'))
const PatientsPage = lazy(() => import('./pages/patients/PatientsPage'))
const PatientDetailPage = lazy(() => import('./pages/patients/PatientDetailPage'))
const BedsPage = lazy(() => import('./pages/beds/BedsPage'))
const AdmissionPage = lazy(() => import('./pages/admission/AdmissionPage'))
const TreatmentPage = lazy(() => import('./pages/treatment/TreatmentPage'))
const DischargePage = lazy(() => import('./pages/discharge/DischargePage'))
const MedicalRecordsPage = lazy(() => import('./pages/medical/MedicalRecordsPage'))
const DoctorsPage = lazy(() => import('./pages/doctors/DoctorsPage'))
const NursingPage = lazy(() => import('./pages/nursing/NursingPage'))
const PharmacyPage = lazy(() => import('./pages/pharmacy/PharmacyPage'))
const LabPage = lazy(() => import('./pages/lab/LabPage'))
const BillingPage = lazy(() => import('./pages/billing/BillingPage'))
const PsychologyPage = lazy(() => import('./pages/psychology/PsychologyPage'))
const VisitorsPage = lazy(() => import('./pages/visitors/VisitorsPage'))
const HrPage = lazy(() => import('./pages/hr/HrPage'))
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage'))
const PayrollPage = lazy(() => import('./pages/payroll/PayrollPage'))
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'))
const KitchenPage = lazy(() => import('./pages/kitchen/KitchenPage'))
const PurchasePage = lazy(() => import('./pages/purchase/PurchasePage'))
const CanteenPage = lazy(() => import('./pages/canteen/CanteenPage'))
const DocumentsPage = lazy(() => import('./pages/documents/DocumentsPage'))
const ComplaintsPage = lazy(() => import('./pages/complaints/ComplaintsPage'))
const AssetsPage = lazy(() => import('./pages/assets/AssetsPage'))
const AccountsPage = lazy(() => import('./pages/accounts/AccountsPage'))
const UsersPage = lazy(() => import('./pages/users/UsersPage'))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'))
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'))
const GeneralManagementPage = lazy(() => import('./pages/management/GeneralManagementPage'))
const CeoControlPage = lazy(() => import('./pages/ceo/CeoControlPage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))
const CompliancePage = lazy(() => import('./pages/compliance/CompliancePage'))
const SecurityPage = lazy(() => import('./pages/security/SecurityPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))

const REAL_MODULE_IDS = new Set([
  'owner-dashboard',
  'registration',
  'patients',
  'beds',
  'admission',
  'treatment',
  'discharge',
  'medical-records',
  'doctors',
  'nursing',
  'pharmacy',
  'lab',
  'billing',
  'psychology',
  'visitors',
  'hr',
  'attendance',
  'payroll',
  'inventory',
  'kitchen',
  'purchase',
  'canteen',
  'documents',
  'complaints',
  'assets',
  'accounts',
  'users',
  'notifications',
  'tasks',
  'general-management',
  'ceo-control',
  'reports',
  'compliance',
  'security',
  'settings',
])

function RouteFallback() {
  return (
    <div className="page" style={{ padding: 24 }}>
      <Skeleton height={28} width="240px" />
      <Skeleton height={160} className="mt-3" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<HomeRedirect />} />
              <Route path="owner-dashboard" element={<OwnerDashboard />} />
              <Route path="ceo-control" element={<CeoControlPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="compliance" element={<CompliancePage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="registration" element={<RegistrationPage />} />
              <Route path="patients" element={<PatientsPage />} />
              <Route path="patients/:id" element={<PatientDetailPage />} />
              <Route path="beds" element={<BedsPage />} />
              <Route path="admission" element={<AdmissionPage />} />
              <Route path="treatment" element={<TreatmentPage />} />
              <Route path="discharge" element={<DischargePage />} />
              <Route path="medical-records" element={<MedicalRecordsPage />} />
              <Route path="doctors" element={<DoctorsPage />} />
              <Route path="nursing" element={<NursingPage />} />
              <Route path="pharmacy" element={<PharmacyPage />} />
              <Route path="lab" element={<LabPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="psychology" element={<PsychologyPage />} />
              <Route path="visitors" element={<VisitorsPage />} />
              <Route path="hr" element={<HrPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="payroll" element={<PayrollPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="kitchen" element={<KitchenPage />} />
              <Route path="purchase" element={<PurchasePage />} />
              <Route path="canteen" element={<CanteenPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="complaints" element={<ComplaintsPage />} />
              <Route path="assets" element={<AssetsPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="general-management" element={<GeneralManagementPage />} />
              {MODULES.filter((m) => !REAL_MODULE_IDS.has(m.id)).map((m) => (
                <Route
                  key={m.id}
                  path={m.path.replace('/app/', '')}
                  element={<ModulePage />}
                />
              ))}
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        <Toaster richColors position="top-right" closeButton />
      </BrowserRouter>
    </AuthProvider>
  )
}
