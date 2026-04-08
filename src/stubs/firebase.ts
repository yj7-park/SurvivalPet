/**
 * Firebase stub — single-player build 전용.
 * 이 파일이 firebase/app 및 firebase/database 대신 번들에 포함됩니다.
 * isFirebaseConfigured()가 false를 반환하므로 실제 호출은 일어나지 않습니다.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const initializeApp = (): any => null;
export const getDatabase   = (): any => null;
export const ref           = (): any => null;
export const set           = (): Promise<void> => Promise.resolve();
export const onValue       = (): (() => void) => () => {};
export const onDisconnect  = (): any => ({ remove: () => Promise.resolve() });
export const off           = (): void => {};

// Type aliases (runtime에서는 사용되지 않음)
export type FirebaseApp = unknown;
export type Database    = unknown;
