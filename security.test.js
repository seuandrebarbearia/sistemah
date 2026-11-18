import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { createApp } from './server.js';
const senha = 'senha-apenas-para-teste';
const salt = '0123456789abcdef0123456789abcdef';
const passwordHash = salt + ':' + scryptSync(senha, salt, 64).toString('hex');

test('server enforces authentication, origin, validation, expiry and logout', async t => {
  const temp = mkdtempSync(join(tmpdir(), 'sistemah-security-'));
  let now = Date.now();
  const app = createApp({ passwordHash, publicOrigin: 'https://cardapio.example', dataFile: join(temp, 'products.json'), now: () => now });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.close(resolve)); rmSync(temp, { recursive: true }); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const request = (path, method = 'GET', body, cookie, origin = 'https://cardapio.example') => fetch(base + path, { method, redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal((await request('/api/session', 'GET', undefined, 'logado=true')).status, 401);
  assert.equal((await request('/admin.html')).status, 303);
  const item = { nome: '<img src=x onerror=alert(1)>', descricao: 'Teste', preco: 15, categoria: 'lanche', imagem: '' };
  assert.equal((await request('/api/products', 'POST', item, 'logado=true')).status, 401);
  assert.equal((await request('/api/products/1', 'DELETE', undefined, 'logado=true')).status, 401);
  assert.equal((await request('/api/login', 'POST', { senha }, undefined, 'https://evil.example')).status, 403);
  assert.equal((await request('/api/login', 'POST', { senha: 'errada' })).status, 401);
  const login = await request('/api/login', 'POST', { senha });
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure', '__Host-sistemah=']) assert.ok(header.includes(flag));
  const cookie = header.split(';')[0];
  assert.equal((await request('/admin.html', 'GET', undefined, cookie)).status, 200);
  for (const change of [{ preco: -1 }, { preco: null }, { imagem: 'javascript:alert(1)' }, { imagem: 'data:image/svg+xml;base64,PHN2Zz4=' }, { categoria: 'admin' }]) {
    assert.equal((await request('/api/products', 'POST', { ...item, ...change }, cookie)).status, 400);
  }
  const created = await request('/api/products', 'POST', item, cookie);
  assert.equal(created.status, 201);
  const saved = await created.json();
  assert.equal((await (await request('/api/products')).json())[0].id, saved.id);
  for (const path of ['/server.js', '/data/products.json', '/password-hash.js', '/.env', '/security.test.js']) assert.equal((await request(path)).status, 404);
  assert.equal((await request('/api/products/' + saved.id, 'DELETE', undefined, cookie, 'https://evil.example')).status, 403);
  assert.equal((await request('/api/logout', 'POST', undefined, cookie)).status, 200);
  assert.equal((await request('/api/products/' + saved.id, 'DELETE', undefined, cookie)).status, 401);
  const second = await request('/api/login', 'POST', { senha });
  const secondCookie = second.headers.get('set-cookie').split(';')[0];
  now += 2 * 60 * 60 * 1000 + 1;
  assert.equal((await request('/api/session', 'GET', undefined, secondCookie)).status, 401);
  for (let index = 0; index < 5; index++) assert.equal((await request('/api/login', 'POST', { senha: 'errada' })).status, 401);
  assert.equal((await request('/api/login', 'POST', { senha })).status, 429);
  now += 900001;
  assert.equal((await request('/api/login', 'POST', { senha })).status, 200);
});
test('product output treats injected markup as text', () => {
  const context = vm.createContext({ document: { addEventListener() {} } });
  vm.runInContext(readFileSync(new URL('./safe.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('./script.js', import.meta.url), 'utf8'), context);
  const markup = vm.runInContext(`cardProduto({ id: '" onclick="alert(1)', nome: '<script>alert(1)</script>', descricao: '<img src=x onerror=alert(1)>', preco: 10, imagem: 'javascript:alert(1)' })`, context);
  assert.ok(!markup.includes('<script>'));
  assert.ok(!markup.includes('<img src=x'));
  assert.ok(!markup.includes('javascript:'));
  assert.ok(markup.includes('&lt;script&gt;'));
  assert.ok(!/\sonclick="/.test(markup));
});
test('startup fails closed without server credentials or HTTPS', () => {
  assert.throws(() => createApp({ publicOrigin: 'https://cardapio.example' }), /ADMIN_PASSWORD_HASH/);
  assert.throws(() => createApp({ passwordHash, publicOrigin: 'http://cardapio.example' }), /HTTPS/);
});
