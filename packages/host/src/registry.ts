import type { HostShell } from './types';

let currentShell: HostShell | null = null;

export function setHostShell(shell: HostShell): void {
  currentShell = shell;
}

export function getHostShell(): HostShell {
  if (!currentShell) {
    throw new Error('HostShell not initialized. Call setHostShell() at app boot.');
  }
  return currentShell;
}

export function tryGetHostShell(): HostShell | null {
  return currentShell;
}

export { type HostShell, type HostFs, type HostPaths, type HostNet } from './types';
