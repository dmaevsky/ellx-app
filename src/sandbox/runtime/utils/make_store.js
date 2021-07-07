import { tx } from 'tinyx';
import { logger } from 'tinyx/middleware/logger';

const withLogger = process.env.NODE_ENV !== 'development'
  ? i => i
  : logger((...args) => console.debug(...args));

export const makeStore = initialState => withLogger(tx(initialState));
