// Vercel serverless adapter — forward every request into the existing corpus
// HTTP server with zero changes to its routing logic. The server is built once
// per cold start and reads only the baked src/content.json bundle.
//
// vercel.json rewrites all paths to this function and preserves the original
// URL, so the server's own router (which switches on req.url) is unchanged.
import { createCorpusServer } from "../src/server.js";

const server = createCorpusServer();

export default function handler(req, res) {
  // http.Server is an EventEmitter; the request listener registered by
  // createServer() runs on the 'request' event with our (req, res).
  server.emit("request", req, res);
}
