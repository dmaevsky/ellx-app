export const isIterable = obj => obj !== null && obj !== undefined && typeof obj[Symbol.iterator] === 'function';
export const isSubscribable = obj => !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.subscribe === 'function';

export const STALE = '@@io.ellx.STALE';
export const STALE_BUNDLE = '@@io.ellx.STALE.bundle';
export const STALE_REQUIRE = '@@io.ellx.STALE.require';

export const isStale = value => typeof value === 'string' && value.startsWith(STALE);
