const PREFIX = 'jadeed_pharmacy_draft_'

export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveDraft(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ ...data, saved_at: Date.now() }))
  } catch {
    // ignore quota
  }
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

export function listFulfillDrafts() {
  const rows = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const fullKey = localStorage.key(i)
      if (!fullKey || !fullKey.startsWith(`${PREFIX}fulfill_`)) continue
      const id = fullKey.slice(`${PREFIX}fulfill_`.length)
      const data = loadDraft(`fulfill_${id}`)
      if (!data || !Array.isArray(data.lines)) continue
      rows.push({
        id,
        lines: data.lines,
        saved_at: data.saved_at || null,
        line_count: data.lines.filter((line) => line.medicine_id || line.medicine_label).length,
      })
    }
  } catch {
    return []
  }
  return rows.sort((a, b) => Number(b.saved_at || 0) - Number(a.saved_at || 0))
}

export function hasFulfillDraft(id) {
  const draft = loadDraft(`fulfill_${id}`)
  return Array.isArray(draft?.lines) && draft.lines.length > 0
}
