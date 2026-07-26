export function VinylMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      {/* sheen — light catching the top-left edge of the disc */}
      <path
        d="M6.2 7.2a9.5 9.5 0 0 1 4.2-3.4"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* disc edge */}
      <circle cx="12" cy="12" r="9.5" strokeWidth="1.4" />
      {/* grooves — dashed circles read as record grooves at any size */}
      <circle cx="12" cy="12" r="6.6" strokeWidth="1" strokeDasharray="2.4 1.8" opacity="0.55" />
      <circle cx="12" cy="12" r="4.4" strokeWidth="1" strokeDasharray="2.4 1.8" opacity="0.55" />
      {/* label + spindle hole */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.75" fill="var(--color-surface)" stroke="none" />
    </svg>
  );
}
