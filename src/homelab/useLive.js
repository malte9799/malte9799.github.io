import { useSyncExternalStore } from 'react';
import { store } from './data/simulator';

/** Current snapshot of the (mock) live state; re-renders every tick. */
export const useLive = () => useSyncExternalStore(store.subscribe, store.getSnapshot);
