#!/usr/bin/env node
/**
 * Instrument connector agent.
 *
 * Reads an ASTM or HL7 v2 file (or stdin), authenticates to the LIMS and posts
 * the raw message to /api/instruments/messages. Serial/TCP adapters can pipe
 * frames into stdin without changing the LIMS API.
 *
 * Usage:
 *   LIMS_URL=http://localhost:4000/api LIMS_EMAIL=tech@... LIMS_PASSWORD=... \
 *   node index.mjs --protocol ASTM --file result.astm
 */
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
function arg(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}

const base = process.env.LIMS_URL ?? 'http://localhost:4000/api';
const email = process.env.LIMS_EMAIL;
const password = process.env.LIMS_PASSWORD;
const labCode = process.env.LIMS_LAB_CODE ?? 'HISTO';
const protocol = (arg('protocol', 'ASTM') ?? 'ASTM').toUpperCase();
const file = arg('file');

if (!email || !password) {
  console.error('LIMS_EMAIL and LIMS_PASSWORD are required.');
  process.exit(2);
}

const raw = file
  ? await readFile(file, 'utf8')
  : await new Promise((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });
      process.stdin.on('end', () => resolve(data));
    });

const login = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ labCode, email, password }),
});
if (!login.ok) {
  console.error('Login failed:', await login.text());
  process.exit(1);
}
const session = await login.json();
const response = await fetch(`${base}/instruments/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
  body: JSON.stringify({ protocol, message: raw }),
});
if (!response.ok) {
  console.error('Ingest failed:', await response.text());
  process.exit(1);
}
console.log(JSON.stringify(await response.json(), null, 2));
