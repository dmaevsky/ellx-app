export const isIterable = obj => obj !== null && obj !== undefined && typeof obj[Symbol.iterator] === 'function';
export const isSubscribable = obj => !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.subscribe === 'function';
