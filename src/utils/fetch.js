import { whenFinished } from 'conclure';
import fetch from 'node-fetch';
import AbortController from 'node-abort-controller';

export function* abortableFetch(url, options) {
  const controller = new AbortController();

  const promise = fetch(url, { ...options, signal: controller.signal });
  whenFinished(promise, ({ cancelled }) => cancelled && controller.abort());

  const res = yield promise;
  const contentType = res.headers.get('Content-Type');

  const body = yield res.text();
  const isJSON = contentType && contentType.includes('application/json');

  if (!res.ok) {
    throw new Error(isJSON && JSON.parse(body).error || res.statusText);
  }

  return {
    url: res.url,
    body,
    isJSON
  };
}
