#!/usr/bin/env node
import http from 'http';
import WebSocket from 'ws';
import commandLineArgs from 'command-line-args';
import { join, dirname } from 'path';
import polka from 'polka';

import serve from 'serve-static';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { startDevPipe } from './dev_pipe.js';

const publicDir = join(__dirname, '../dist');

// first - parse the main command
const mainDefinitions = [
  { name: 'command', defaultOption: true }
];
const mainOptions = commandLineArgs(mainDefinitions, { stopAtFirstUnknown: true });
const argv = mainOptions._unknown || [];

// second - parse the merge command options
if (mainOptions.command === 'start') {
  const startDefinitions = [
    { name: 'port', alias: 'p', type: Number },
  ];

  const config = commandLineArgs(startDefinitions, { argv });

  config.port = config.port || 3002;

  const server = http.createServer();

  polka({ server })
    .use(serve(publicDir))
    .listen(config.port, err => {
      if (err) throw err;
      console.log(`> Running on localhost:${config.port}`);
    });

  const wss = new WebSocket.Server({ server, path: '/@@dev' });

  wss.on('connection', ws => startDevPipe(ws, process.cwd() + '/src'));
}
else {
  console.log(`Please specify a command:
    start
    login (WIP)
    publish (WIP)
    deploy (WIP)
  `);
  process.exit(1);
}
