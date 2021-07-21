// This is temporary
// It should disappear once we get rid of "~owner/project" imports

export default process.env.API_URL || (process.env.NODE_ENV === 'production'
  ? 'https://api.ellx.io'
  : 'https://test-api.ellx.io'
);
