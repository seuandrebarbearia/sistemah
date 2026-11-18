import { createHash, timingSafeEqual, randomBytes, randomUUID } from 'node:crypto';

const ttl = 2 * 60 * 60 * 1000;
const failure = (status, message) => Object.assign(new Error(message), { status });
const digest = value => createHash('sha256').update(value).digest();
const cookie = (token, age) => `__Host-sistemah=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const tokenOf = req => (req.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith('__Host-sistemah='))?.slice(16) || '';
const json = (status, data, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type') || '')) throw failure(415, 'Envie JSON.');
  if (!req.body) throw failure(400, 'Dados ausentes.');
  const reader = req.body.getReader();
  const chunks = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 1_500_000) { await reader.cancel(); throw failure(413, 'Arquivo muito grande.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw failure(400, 'JSON inválido.'); }
}
function product(input) {
  if (!input || typeof input !== 'object') throw failure(400, 'Produto inválido.');
  const { nome, descricao, preco, categoria, imagem = '' } = input;
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 120 ||
      typeof descricao !== 'string' || !descricao.trim() || descricao.length > 1000 ||
      typeof preco !== 'number' || !Number.isFinite(preco) || preco <= 0 || preco > 100000 ||
      !['lanche','bebida'].includes(categoria) || typeof imagem !== 'string' || imagem.length > 1_400_000 ||
      (imagem && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imagem))) throw failure(400, 'Confira os dados e a imagem PNG, JPEG ou WebP.');
  return { id: randomUUID(), nome: nome.trim(), descricao: descricao.trim(), preco: Math.round(preco * 100) / 100, categoria, imagem };
}

// One persistent object owns the catalog, sessions and login attempt limits.
export class Catalog {
  constructor(ctx, env) {
    this.sql = ctx.storage.sql; this.env = env;
    this.sql.exec('CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, expiry INTEGER NOT NULL, credential TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS attempts(client TEXT PRIMARY KEY, count INTEGER NOT NULL, expiry INTEGER NOT NULL)');
  }
  session(req) {
    const token = tokenOf(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.sql.exec('SELECT expiry,credential FROM sessions WHERE token=?', digest(token).toString('hex')).toArray()[0];
    return row && row.expiry > Date.now() && row.credential === digest(this.env.ADMIN_PASSWORD || '').toString('hex') ? token : null;
  }
  async fetch(req) {
    try {
      const url = new URL(req.url), path = url.pathname;
      if (!['GET','POST','DELETE'].includes(req.method)) throw failure(405, 'Método não permitido.');
      if (req.method !== 'GET' && req.headers.get('Origin') !== url.origin) throw failure(403, 'Origem não permitida.');
      const now = Date.now();
      this.sql.exec('DELETE FROM sessions WHERE expiry<=?', now);
      this.sql.exec('DELETE FROM attempts WHERE expiry<=?', now);
      if (path === '/api/products' && req.method === 'GET') return json(200, this.sql.exec('SELECT payload FROM products ORDER BY rowid').toArray().map(row => JSON.parse(row.payload)));
      if (path === '/api/login' && req.method === 'POST') {
        if (typeof this.env.ADMIN_PASSWORD !== 'string' || this.env.ADMIN_PASSWORD.length < 12 || this.env.ADMIN_PASSWORD.length > 256) throw failure(503, 'O administrador precisa concluir a configuração de acesso.');
        const input = await body(req);
        const client = 'ip:' + digest(req.headers.get('CF-Connecting-IP') || 'unknown').toString('hex');
        for (const [key, limit] of [[client,5],['global',100]]) {
          const row = this.sql.exec('SELECT count FROM attempts WHERE client=?', key).toArray()[0];
          if (row?.count >= limit) throw failure(429, 'Muitas tentativas. Aguarde 15 minutos.');
        }
        for (const key of [client,'global']) this.sql.exec('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(client) DO UPDATE SET count=count+1', key, now + 900000);
        if (typeof input?.senha !== 'string' || input.senha.length > 256 || !timingSafeEqual(digest(input.senha), digest(this.env.ADMIN_PASSWORD))) throw failure(401, 'Senha incorreta.');
        this.sql.exec('DELETE FROM attempts WHERE client=?', client);
        const previous = this.session(req);
        if (previous) this.sql.exec('DELETE FROM sessions WHERE token=?', digest(previous).toString('hex'));
        const token = randomBytes(32).toString('hex');
        this.sql.exec('INSERT INTO sessions VALUES (?,?,?)', digest(token).toString('hex'), now + ttl, digest(this.env.ADMIN_PASSWORD).toString('hex'));
        return json(200, { ok: true }, { 'Set-Cookie': cookie(token, ttl / 1000) });
      }
      if (path === '/api/logout' && req.method === 'POST') {
        const token = tokenOf(req);
        this.sql.exec('DELETE FROM sessions WHERE token=?', digest(token).toString('hex'));
        return json(200, { ok: true }, { 'Set-Cookie': cookie('',0) });
      }
      if (!this.session(req)) throw failure(401, 'Entre para continuar.');
      if (path === '/api/session' && req.method === 'GET') return json(200, { ok: true });
      if (path === '/api/products' && req.method === 'POST') {
        const item = product(await body(req));
        if (this.sql.exec('SELECT count(*) AS n FROM products').toArray()[0].n >= 500) throw failure(409, 'Limite de produtos atingido.');
        this.sql.exec('INSERT INTO products VALUES (?,?)', item.id, JSON.stringify(item));
        return json(201, item);
      }
      if (path.startsWith('/api/products/') && req.method === 'DELETE') {
        const id = path.slice('/api/products/'.length);
        if (!this.sql.exec('SELECT id FROM products WHERE id=?',id).toArray().length) throw failure(404, 'Produto não encontrado.');
        this.sql.exec('DELETE FROM products WHERE id=?',id);
        return json(200, { ok: true });
      }
      throw failure(404, 'Rota não encontrada.');
    } catch (error) { return json(error.status || 500, { error: error.status ? error.message : 'Não foi possível concluir a operação.' }); }
  }
}

const files = new Set(['/', '/index.html','/login.html','/admin.html','/script.js','/admin.js','/login.js','/safe.js','/style.css']);
function secure(response) {
  const result = new Response(response.body, response);
  for (const [name,value] of Object.entries({
    'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer', 'Strict-Transport-Security':'max-age=31536000',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  })) result.headers.set(name,value);
  return result;
}
export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);
      if (url.protocol !== 'https:') return secure(new Response(null,{status:308,headers:{Location:'https://' + url.host + url.pathname + url.search}}));
      const catalog = () => env.CATALOG.get(env.CATALOG.idFromName('main'));
      if (url.pathname.startsWith('/api/')) return secure(await catalog().fetch(req));
      if (!['GET','HEAD'].includes(req.method)) return secure(json(405,{error:'Método não permitido.'}));
      if (!files.has(url.pathname)) return secure(json(404,{error:'Página não encontrada.'}));
      if (url.pathname === '/admin.html') {
        const check = new Request(new URL('/api/session',url), { headers: req.headers });
        if (!(await catalog().fetch(check)).ok) return secure(new Response(null,{status:303,headers:{Location:'/login.html'}}));
      }
      return secure(await env.ASSETS.fetch(req));
    } catch { return secure(json(503,{error:'Serviço temporariamente indisponível.'})); }
  }
};
