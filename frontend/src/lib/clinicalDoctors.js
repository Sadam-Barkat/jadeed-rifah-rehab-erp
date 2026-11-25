/** Clinical doctor login roles (rehab). */
export const CLINICAL_DOCTOR_SLUGS = [
  'consultant-psychiatrist',
  'medical-officer',
  'doctor', // legacy
]

export function isClinicalDoctor(userOrSlug) {
  const slug = typeof userOrSlug === 'string' ? userOrSlug : userOrSlug?.role_slug
  return CLINICAL_DOCTOR_SLUGS.includes(slug)
}

export const DOCTOR_ROLE_LABELS = {
  'consultant-psychiatrist': 'Consultant Psychiatrist',
  'medical-officer': 'Medical Officer',
  doctor: 'Doctor',
}
