import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import HomeRedirect from './components/HomeRedirect'
import Skeleton from './components/ui/Skeleton'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'))
const RoleHomePage = lazy(() => import('./pages/homes/RoleHomePage'))
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
const BillingPage = lazy(() => import('./pages/billing/BillingPage'))
const PaymentApprovalPage = lazy(() => import('./pages/billing/PaymentApprovalPage'))
const VisitorsPage = lazy(() => import('./pages/visitors/VisitorsPage'))
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'))
const KitchenPage = lazy(() => import('./pages/kitchen/KitchenPage'))
const AccountsPage = lazy(() => import('./pages/accounts/AccountsPage'))
const UsersPage = lazy(() => import('./pages/users/UsersPage'))
const ManagementPage = lazy(() => import('./pages/management/ManagementPage'))
const AdminSectionPage = lazy(() => import('./pages/admin/AdminSectionPage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))
const LogsPage = lazy(() => import('./pages/logs/LogsPage'))

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
              <Route path="home/receptionist" element={<RoleHomePage roleKey="receptionist" />} />
              <Route path="home/gatekeeper" element={<RoleHomePage roleKey="gatekeeper" />} />
              <Route path="home/doctor" element={<RoleHomePage roleKey="doctor" />} />
              <Route path="home/nurse" element={<RoleHomePage roleKey="nurse" />} />
              <Route path="home/finance" element={<RoleHomePage roleKey="finance" />} />
              <Route path="home/pharmacist" element={<RoleHomePage roleKey="pharmacist" />} />
              <Route path="home/inventory" element={<RoleHomePage roleKey="inventory-manager" />} />
              <Route path="owner-dashboard" element={<OwnerDashboard />} />
              <Route path="admin/patients-beds" element={<AdminSectionPage section="patients" fallbackTitle="Patients & beds overview" />} />
              <Route path="admin/pharmacy" element={<AdminSectionPage section="pharmacy" fallbackTitle="Pharmacy overview" />} />
              <Route path="admin/inventory" element={<AdminSectionPage section="inventory" fallbackTitle="Inventory overview" />} />
              <Route path="admin/finance" element={<AdminSectionPage section="finance" fallbackTitle="Billing & finance overview" />} />
              <Route path="admin/visitors" element={<AdminSectionPage section="visitors" fallbackTitle="Visitors overview" />} />
              <Route path="admin/staff" element={<AdminSectionPage section="staff" fallbackTitle="Staff overview" />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="logs" element={<LogsPage />} />
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
              <Route path="billing" element={<BillingPage />} />
              <Route path="payments/:id" element={<PaymentApprovalPage />} />
              <Route path="visitors" element={<VisitorsPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="kitchen" element={<KitchenPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="management" element={<ManagementPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        <Toaster richColors position="top-right" closeButton />
      </BrowserRouter>
    </AuthProvider>
  )
}
