import { filterMessages, sendToFrame } from 'ellx/utils/messaging';
import { loadBody } from './body_parse';

export default function Spreadsheet(frameId, contentId) {
  const select = what => ({ contentId: cid, type }) => cid === contentId && type === what;

  function init(body, onChange) {
    sendToFrame(frameId, {
      type: 'init',
      args: [contentId, body && loadBody(body)]
    });

    const listener = filterMessages(
      frameId,
      select('serialize'),
      ({ body: b }) => onChange(b)
    );
    window.addEventListener('message', listener);

    serialize();

    return function dispose() {
      window.removeEventListener('message', listener);

      sendToFrame(frameId, {
        type: 'dispose',
        args: [contentId]
      });
    };
  }

  function update() {
    throw new Error('Update is not implemented for the sheet model');
  }

  async function serialize() {
    const { body } = await sendToFrame(
      frameId, {
        type: 'serialize',
        args: [contentId]
      },
      select('serialize')
    );
    return body;
  }

  return { init, serialize, update };
}
