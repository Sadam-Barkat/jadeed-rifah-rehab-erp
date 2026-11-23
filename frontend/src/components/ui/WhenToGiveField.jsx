const PRESETS = [
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
  '8:00 AM',
  '2:00 PM',
  '8:00 PM',
  'After meals',
  'Before meals',
  'OD',
  'BD',
  'TDS',
  'SOS',
]

function partsOf(value) {
  return String(value || '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean)
}

export default function WhenToGiveField({ id, value, onChange }) {
  const selected = partsOf(value)

  function toggle(preset) {
    const next = selected.includes(preset)
      ? selected.filter((item) => item !== preset)
      : [...selected, preset]
    onChange?.(next.join(' · '))
  }

  return (
    <div className="when-give-field">
      <input
        id={id}
        className="ui-input"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Click options below"
      />
      <div className="when-give-chips" role="group" aria-label="When to give options">
        {PRESETS.map((preset) => {
          const active = selected.includes(preset)
          return (
            <button
              key={preset}
              type="button"
              className={`when-give-chip${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => toggle(preset)}
            >
              {preset}
            </button>
          )
        })}
      </div>
    </div>
  )
}
