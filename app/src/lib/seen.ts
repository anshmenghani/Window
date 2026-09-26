// Windows you've opened during this session, so the "New" badge on Today goes away.
export const openedWindows = new Set<string>();

// Windows whose envelope you've already opened, so the envelope only plays the first time.
export const unsealedWindows = new Set<string>();
