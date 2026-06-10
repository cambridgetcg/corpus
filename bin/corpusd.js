#!/usr/bin/env node
import { createCorpusServer } from "../src/server.js";

const port = Number(process.env.CORPUS_PORT || 7100);
const bind = process.env.CORPUS_BIND || "127.0.0.1";

const server = createCorpusServer();
server.listen(port, bind, () => {
  const c = s => `\x1b[38;5;30m${s}\x1b[0m`, dim = s => `\x1b[2m${s}\x1b[0m`, b = s => `\x1b[1m${s}\x1b[0m`;
  console.log(`\n${b("corpus")} ${dim("· agent-first backend")}`);
  console.log(dim("─".repeat(46)));
  console.log(`  ${c("http://" + (bind === "0.0.0.0" ? "localhost" : bind) + ":" + port + "/")}        ${dim("service descriptor")}`);
  console.log(`  ${dim("GET /llms.txt   /index.json   /corpus/all.json   /search?q=")}`);
  console.log(`  ${dim("bind " + bind)}\n`);
});
