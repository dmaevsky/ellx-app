const http = require('http');
const WebSocket = require('ws');
const commandLineArgs = require('command-line-args');
const { join } = require('path');
const polka = require("polka");

const publicDir = join(__dirname, '../dist');
const serve = require('serve-static')(publicDir);

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
    .use(serve)
    .listen(config.port, err => {
      if (err) throw err;
      console.log(`> Running on localhost:${config.port}`);
    });

  const wss = new WebSocket.Server({ server, path: '/@@dev' });

  wss.on('connection', ws => {
    ws.on('message', message => {
      console.log('received: %s', message);
    });

    ws.send('ping');
  });
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
