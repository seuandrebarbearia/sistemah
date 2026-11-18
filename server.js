import http from 'node:http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const SESSION_MS = 2 * 60 * 60 * 1000;
const fail = (status, message) => Object.assign(new Error(message), { status });

function product(input) {
  if (!input || typeof input !== 'object') throw fail(400, 'Produto inválido.');
  const { nome, descricao, preco, categoria, imagem = '' } = input;
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 120 ||
      typeof descricao !== 'string' || !descricao.trim() || descricao.length > 1000 ||
      typeof preco !== 'number' || !Number.isFinite(preco) || preco <= 0 || preco > 100000 ||
      !['lanche', 'bebida'].includes(categoria) || typeof imagem !== 'string' ||
      imagem.length > 1_400_000 || (imagem && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imagem))) {
    throw fail(400, 'Confira nome, descrição, preço, categoria e imagem PNG, JPEG ou WebP.');
  }
  return { id: randomUUID(), nome: nome.trim(), descricao: descricao.trim(), preco: Math.round(preco * 100) / 100, categoria, imagem };
}
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw fail(415, 'Envie JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_500_000) throw fail(413, 'Arquivo muito grande.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw fail(400, 'JSON inválido.'); }
}
export function createApp({ passwordHash, publicOrigin, dataFile = resolve(root, 'data/products.json'), production = true, now = Date.now } = {}) {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash || '')) throw new Error('Configure ADMIN_PASSWORD_HASH; não há senha padrão.');
  const origin = new URL(publicOrigin).origin;
  if (production && !origin.startsWith('https://')) throw new Error('Produção exige PUBLIC_ORIGIN com HTTPS.');
  const [salt, digest] = passwordHash.split(':');
  const expected = Buffer.from(digest, 'hex');
  const sessions = new Map(), attempts = new Map();
  let globalAttempts = { count: 0, until: 0 };
  const cookieName = production ? '__Host-sistemah' : 'sistemah';
  const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? '; Secure' : ''}`;
  mkdirSync(dirname(dataFile), { recursive: true });
  let products;
  try {
    products = JSON.parse(readFileSync(dataFile, 'utf8'));
    if (!Array.isArray(products)) throw new Error('Catálogo inválido.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    products = [];
  }
  function persist(next) {
    writeFileSync(`${dataFile}.tmp`, JSON.stringify(next), { mode: 0o600 });
    renameSync(`${dataFile}.tmp`, dataFile);
    products = next;
  }
  function session(req) {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    const expiry = sessions.get(token);
    if (!expiry || expiry <= now()) { sessions.delete(token); return null; }
    return token;
  }
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    function json(status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
    try {
      for (const [key, expiry] of sessions) if (expiry <= now()) sessions.delete(key);
      for (const [key, record] of attempts) if (record.until <= now()) attempts.delete(key);
      const path = new URL(req.url, origin).pathname;
      if (!['GET', 'HEAD', 'POST', 'DELETE'].includes(req.method)) throw fail(405, 'Método não permitido.');
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) throw fail(403, 'Origem não permitida.');
      if (path === '/api/login' && req.method === 'POST') {
        const key = req.socket.remoteAddress; // Do not trust caller-supplied proxy headers.
        const record = attempts.get(key) || { count: 0, until: now() + 900000 };
        if (globalAttempts.until <= now()) globalAttempts = { count: 0, until: now() + 900000 };
        if (record.count >= 5 || globalAttempts.count >= 100) throw fail(429, 'Muitas tentativas. Tente novamente em 15 minutos.');
        const input = await body(req);
        record.count++; globalAttempts.count++; attempts.set(key, record);
        if (typeof input?.senha !== 'string' || input.senha.length > 256 || !timingSafeEqual(scryptSync(input.senha, salt, 64), expected)) throw fail(401, 'Senha incorreta.');
        attempts.delete(key);
        const oldToken = session(req);
        if (oldToken) sessions.delete(oldToken);
        const token = randomBytes(32).toString('hex');
        sessions.set(token, now() + SESSION_MS);
        res.setHeader('Set-Cookie', cookie(token, SESSION_MS / 1000));
        return json(200, { ok: true });
      }
      if (path === '/api/session' && req.method === 'GET') {
        if (!session(req)) throw fail(401, 'Entre para continuar.');
        return json(200, { ok: true });
      }
      if (path === '/api/logout' && req.method === 'POST') {
        const token = session(req);
        if (token) sessions.delete(token);
        res.setHeader('Set-Cookie', cookie('', 0));
        return json(200, { ok: true });
      }
      if (path === '/api/products' && req.method === 'GET') return json(200, products);
      if (path === '/api/products' && req.method === 'POST') {
        if (!session(req)) throw fail(401, 'Entre para continuar.');
        if (products.length >= 500) throw fail(409, 'Limite de produtos atingido.');
        const next = product(await body(req));
        persist([...products, next]);
        return json(201, next);
      }
      if (path.startsWith('/api/products/') && req.method === 'DELETE') {
        if (!session(req)) throw fail(401, 'Entre para continuar.');
        const id = path.slice('/api/products/'.length);
        if (!products.some(p => p.id === id)) throw fail(404, 'Produto não encontrado.');
        persist(products.filter(p => p.id !== id));
        return json(200, { ok: true });
      }
      if (path.startsWith('/api/')) throw fail(404, 'Rota não encontrada.');
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'Método não permitido.');
      if (path === '/admin.html' && !session(req)) { res.writeHead(303, { Location: '/login.html' }); return res.end(); }
      const files = { '/': 'index.html', '/index.html': 'index.html', '/login.html': 'login.html', '/admin.html': 'admin.html', '/script.js': 'script.js', '/admin.js': 'admin.js', '/login.js': 'login.js', '/safe.js': 'safe.js', '/style.css': 'style.css' };
      const file = files[path];
      if (!file) throw fail(404, 'Página não encontrada.');
      const content = readFileSync(resolve(root, file));
      res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { json(error.status || 500, { error: error.status ? error.message : 'Não foi possível concluir a operação.' }); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp({ passwordHash: process.env.ADMIN_PASSWORD_HASH, publicOrigin: process.env.PUBLIC_ORIGIN || `http://localhost:${port}`, production: process.env.NODE_ENV !== 'development' }).listen(port, '127.0.0.1', () => console.log(`Servidor iniciado na porta ${port}.`));
}
