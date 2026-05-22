/** Labelled form field wrapper */
export function Field({ label, hint, error, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-500 -mt-0.5">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

const base = 'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500'

export function Input({ className = '', ...props }) {
  return <input className={`${base} ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${base} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${base} ${className}`} rows={3} {...props} />
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...props} />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}
