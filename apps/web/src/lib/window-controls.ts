import { isTauriEnvironment } from '@vinylly/host';

interface TauriInternals {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    return Promise.reject(new Error('Not in Tauri environment'));
  }
  return window.__TAURI_INTERNALS__!.invoke<T>(cmd, args);
}

export async function minimizeWindow(): Promise<void> {
  await invoke('plugin:window|minimize');
}

export async function toggleMaximize(): Promise<void> {
  await invoke('plugin:window|toggle_maximize');
}

export async function closeWindow(): Promise<void> {
  await invoke('plugin:window|close');
}

export async function startDragging(): Promise<void> {
  await invoke('plugin:window|start_dragging');
}

export async function isMaximized(): Promise<boolean> {
  return invoke<boolean>('plugin:window|is_maximized');
}
