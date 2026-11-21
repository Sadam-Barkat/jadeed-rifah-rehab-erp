/** Canonical role_slug → first home path after login */
export const ROLE_HOME_PATH = {
  admin: '/app/owner-dashboard',
  receptionist: '/app/reception',
  gatekeeper: '/app/visitors?tab=attendance',
  doctor: '/app/home/doctor',
  nurse: '/app/home/nurse',
  finance: '/app/billing',
  pharmacist: '/app/home/pharmacist',
  'inventory-manager': '/app/inventory?tab=use',
}

export function homePathForUser(user) {
  const slug = user?.role_slug
  if (slug && ROLE_HOME_PATH[slug]) return ROLE_HOME_PATH[slug]
  return '/app'
}
