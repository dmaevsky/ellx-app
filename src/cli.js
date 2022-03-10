#!/usr/bin/env node
import http from "http";
import WebSocket from "ws";
import commandLineArgs from "command-line-args";
import { join, dirname } from "path";
import polka from "polka";

import serve from "serve-static";
import { fileURLToPath } from "url";
import { readFile } from "fs";
import open from "open";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { resolveIndex } from './resolve_index.js';
import { startDevPipe } from "./dev_pipe.js";
import { deploy } from "./deploy.js";

import { conclude } from "conclure";

const publicDir = join(__dirname, "./bootstrap");

// first - parse the main command
const mainDefinitions = [{ name: "command", defaultOption: true }];
const mainOptions = commandLineArgs(mainDefinitions, {
  stopAtFirstUnknown: true,
});
const argv = mainOptions._unknown || [];

// second - parse the merge command options
if (mainOptions.command === "start") {
  const startDefinitions = [
    { name: "port", alias: "p", type: Number },
    { name: "open", alias: "o", type: Boolean },
  ];

  const config = commandLineArgs(startDefinitions, { argv });

  config.port = config.port || 3002;

  const server = http.createServer();

  polka({ server })
    .use(serve(publicDir))
    .get("*", (req, res, next) => resolveIndex(publicDir, process.cwd())
      .then(body => res.end(body))
      .catch(error => next(error))
    )
    .listen(config.port, (err) => {
      if (err) throw err;
      const url = `http://localhost:${config.port}`;

      console.log(`> Running on ${url}`);
      if (config.open) open(url).catch((e) => console.log(e));
    });

  const wss = new WebSocket.Server({ server, path: "/@@dev" });

  wss.on("connection", (ws) => startDevPipe(ws, process.cwd()));
}
else if (mainOptions.command === "deploy") {
  const deployDefinitions = [
    {
      name: "env",
      defaultOption: true,
      default: process.env.NODE_ENV || "staging",
      type: String,
    },
    {
      name: "styles",
      defaultValue: "node_modules/@ellx/app/src/input.css",
      type: String,
      alias: "s",
    }
  ];

  const config = commandLineArgs(deployDefinitions, { argv });

  conclude(deploy(process.cwd(), config), (err) => {
    if (err) console.error(err);
  });
}
else {
  console.log(`Please specify a command:
    start
    login (WIP)
    publish (WIP)
    deploy
  `);
  process.exit(1);
}
