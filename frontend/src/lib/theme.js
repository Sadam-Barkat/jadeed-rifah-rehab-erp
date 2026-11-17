/** Theme is stored per user so roles/accounts do not share dark/light. */

export function themeStorageKey(user) {
  if (user?.id) return `jadeed_erp_theme_u${user.id}`
  return 'jadeed_erp_theme_guest'
}

export function readTheme(user) {
  try {
    return localStorage.getItem(themeStorageKey(user)) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme, user) {
  const next = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem(themeStorageKey(user), next)
  } catch {
    /* ignore */
  }
  return next
}

export function applyUserTheme(user) {
  return applyTheme(readTheme(user), user)
}
