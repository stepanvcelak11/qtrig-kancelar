// CI: node tests/node.mjs
import { spust } from './testy.js';
const r = await spust();
process.exit(r.chyb ? 1 : 0);
