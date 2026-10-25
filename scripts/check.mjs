import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];
async function exists(file) {
  try { await access(path.resolve(root, file)); }
  catch { errors.push(`Missing asset: ${file}`); }
}
async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else result.push(file);
  }
  return result;
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
if (/;base64,|<style\b|\sstyle=|\son\w+=/i.test(html)) errors.push('Embedded asset, style or event handler in HTML');
if (/<script\b[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(html)) errors.push('Inline JavaScript in HTML');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
if (new Set(ids).size !== ids.length) errors.push('Duplicate HTML IDs');
for (const [, url] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  if (url.startsWith('#')) {
    if (url.length > 1 && !ids.includes(url.slice(1))) errors.push(`Broken section link: ${url}`);
  } else if (!/^[a-z]+:/i.test(url)) await exists(url);
}
for (const file of await walk(path.join(root, 'src'))) {
  if (!file.endsWith('.js')) continue;
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status) errors.push(check.stderr);
  const source = await readFile(file, 'utf8');
  for (const [, , imported] of source.matchAll(/(?:from\s*|import\s*\(|new URL\()(['"])(\.[^'"]+)\1/g)) {
    await exists(path.relative(root, path.resolve(path.dirname(file), imported)));
  }
}
const catalog = JSON.parse(await readFile(path.join(root, 'data/archive.json'), 'utf8'));
const recordIds = new Set();
for (const record of catalog) {
  if (recordIds.has(record.id)) errors.push(`Duplicate record: ${record.id}`);
  recordIds.add(record.id);
  for (const key of ['id', 'title', 'category', 'image', 'thumb']) if (!record[key]) errors.push(`Record ${record.id} is missing ${key}`);
  await exists(record.image); await exists(record.thumb);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Passed: HTML links, module syntax/imports and ${catalog.length} records with all images.`);
