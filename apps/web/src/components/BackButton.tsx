import { Button } from '@vinylly/ui';

export interface BackButtonProps {
  onClick: () => void;
  label: string;
}

export function BackButton({ onClick, label }: BackButtonProps) {
  return (
    <Button variant="neutral" size="sm" onClick={onClick} leftIcon={<BackIcon />}>
      {label}
    </Button>
  );
}

export function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M19 12H5m6-6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
