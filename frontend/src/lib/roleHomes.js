/** Canonical role_slug → first home path after login */
export const ROLE_HOME_PATH = {
  admin: '/app/owner-dashboard',
  receptionist: '/app/home/receptionist',
  gatekeeper: '/app/home/gatekeeper',
  doctor: '/app/home/doctor',
  nurse: '/app/home/nurse',
  finance: '/app/home/finance',
  pharmacist: '/app/home/pharmacist',
  'inventory-manager': '/app/home/inventory',
}

export function homePathForUser(user) {
  const slug = user?.role_slug
  if (slug && ROLE_HOME_PATH[slug]) return ROLE_HOME_PATH[slug]
  return '/app'
}
