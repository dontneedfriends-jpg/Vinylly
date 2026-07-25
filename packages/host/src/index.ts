export * from './types';
export { setHostShell, resetHostShell, getHostShell, tryGetHostShell } from './registry';
export { createWebHostShell } from './web';
export { createTauriHostShell, isTauriEnvironment } from './tauri';
export type { ProfileRecord, ProfilesIndex, ProfileConfig } from './types';
