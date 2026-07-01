import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { getHostShell } from '@vinylly/host';

interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

export function ExternalLink({ href, children, onClick, ...props }: ExternalLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      getHostShell().openUrl(href);
    }
    onClick?.(e);
  };

  return (
    <a href={href} onClick={handleClick} rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}
