export const ROLES = [
  'Admin',
  'Receptionist',
  'Gatekeeper',
  'Doctor',
  'Nurse',
  'Finance',
  'Pharmacist',
  'Inventory Manager',
]

/** Admin sidebar only — overview tabs + management (not operational CRUD). */
export const ADMIN_NAV = [
  { id: 'owner-dashboard', name: 'Overview', path: '/app/owner-dashboard' },
  { id: 'admin-patients', name: 'Patients & Beds', path: '/app/admin/patients-beds' },
  { id: 'admin-pharmacy', name: 'Pharmacy', path: '/app/admin/pharmacy' },
  { id: 'admin-inventory', name: 'Inventory', path: '/app/admin/inventory' },
  { id: 'admin-finance', name: 'Billing & Finance', path: '/app/admin/finance' },
  { id: 'admin-visitors', name: 'Visitors', path: '/app/admin/visitors' },
  { id: 'admin-staff', name: 'Staff', path: '/app/admin/staff' },
  { id: 'users', name: 'Management', path: '/app/management' },
  { id: 'settings', name: 'Settings', path: '/app/settings' },
  { id: 'logs', name: 'Logs', path: '/app/logs' },
]

/** Staff / role operational modules (shown by role permissions). */
export const MODULES = [
  { id: 'registration', name: 'Patient Registration', path: '/app/registration', group: 'Patient Care' },
  { id: 'admission', name: 'Patient Admission', path: '/app/admission', group: 'Patient Care' },
  { id: 'patients', name: 'Patients', path: '/app/patients', group: 'Patient Care' },
  { id: 'beds', name: 'Beds', path: '/app/beds', group: 'Patient Care' },
  { id: 'medical-records', name: 'Medical Records', path: '/app/medical-records', group: 'Patient Care' },
  { id: 'doctors', name: 'Doctor Rounds', path: '/app/doctors', group: 'Patient Care' },
  { id: 'nursing', name: 'Nursing', path: '/app/nursing', group: 'Patient Care' },
  { id: 'treatment', name: 'Treatment', path: '/app/treatment', group: 'Patient Care' },
  { id: 'discharge', name: 'Discharge', path: '/app/discharge', group: 'Patient Care' },
  { id: 'pharmacy', name: 'Pharmacy', path: '/app/pharmacy', group: 'Clinical' },
  { id: 'billing', name: 'Billing', path: '/app/billing', group: 'Finance' },
  { id: 'accounts', name: 'Accounts', path: '/app/accounts', group: 'Finance' },
  { id: 'reports', name: 'Reports', path: '/app/reports', group: 'Finance' },
  { id: 'inventory', name: 'Inventory', path: '/app/inventory', group: 'Operations' },
  { id: 'kitchen', name: 'Kitchen Stock', path: '/app/kitchen', group: 'Operations' },
  { id: 'visitors', name: 'Gate Visitors', path: '/app/visitors', group: 'Operations' },
]

export const MODULE_GROUPS = [
  'Patient Care',
  'Clinical',
  'Finance',
  'Operations',
]
