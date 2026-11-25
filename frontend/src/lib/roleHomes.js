/** Canonical role_slug → first home path after login */
export const ROLE_HOME_PATH = {
  admin: '/app/owner-dashboard',
  receptionist: '/app/reception',
  gatekeeper: '/app/visitors?tab=attendance',
  doctor: '/app/doctors?tab=vitals',
  'consultant-psychiatrist': '/app/doctors?tab=vitals',
  'medical-officer': '/app/doctors?tab=vitals',
  nurse: '/app/nursing?tab=slips',
  finance: '/app/billing',
  dispenser: '/app/pharmacy?tab=prescriptions',
  'inventory-manager': '/app/inventory?tab=use',
  cook: '/app/inventory?tab=use',
  'clinical-psychologist': '/app/psychology',
  maulana: '/app/maulana',
}

export function homePathForUser(user) {
  const slug = user?.role_slug
  if (slug && ROLE_HOME_PATH[slug]) return ROLE_HOME_PATH[slug]
  return '/app'
}
