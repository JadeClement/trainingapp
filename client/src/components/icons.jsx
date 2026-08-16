export function ClockIcon(props) {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8L10.25 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RulerIcon(props) {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <rect x="1" y="5.5" width="14" height="5" rx="0.75" />
      <path d="M4 5.5V8M7 5.5V7.5M10 5.5V8M13 5.5V7.5" strokeLinecap="round" />
    </svg>
  );
}

export function EyeIcon(props) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}
