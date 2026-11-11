import './ui.css'

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
