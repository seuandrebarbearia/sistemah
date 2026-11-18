async function api(path, options = {}) {
  const response = await fetch(path, options);
  if (response.status === 401) { location.replace('login.html'); throw new Error('Entre para continuar.'); }
  if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Operação não concluída.'); }
  return response.json();
}
function voltarIndex() { location.href = 'index.html'; }
async function logout() {
  try { await api('/api/logout', { method: 'POST' }); location.replace('index.html'); }
  catch (error) { alert(error.message); }
}
async function renderAdmin() {
  const products = await api('/api/products');
  const list = document.getElementById('lista-admin');
  list.replaceChildren();
  if (!products.length) { list.textContent = 'Nenhum produto cadastrado.'; return; }
  for (const product of products) {
    const card = document.createElement('div');
    card.className = 'card';
    if (safeImage(product.imagem)) {
      const image = document.createElement('img');
      image.src = safeImage(product.imagem); image.alt = product.nome; image.className = 'img-produto'; card.append(image);
    }
    for (const [tag, text] of [['h3', product.nome], ['p', product.descricao], ['p', 'R$ ' + Number(product.preco).toFixed(2)], ['p', product.categoria]]) {
      const field = document.createElement(tag); field.textContent = text; card.append(field);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Excluir';
    remove.addEventListener('click', async () => {
      try { await api('/api/products/' + encodeURIComponent(product.id), { method: 'DELETE' }); await renderAdmin(); }
      catch (error) { alert(error.message); }
    });
    card.append(remove); list.append(card);
  }
}
async function adicionar() {
  const form = document.getElementById('product-form');
  if (!form.reportValidity()) return;
  const file = document.getElementById('imagem').files[0];
  if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1000000)) {
    alert('Escolha uma imagem PNG, JPEG ou WebP de até 1 MB.'); return;
  }
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const imagem = file ? await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
    }) : '';
    await api('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      nome: document.getElementById('nome').value.trim(), descricao: document.getElementById('descricao').value.trim(),
      preco: Number(document.getElementById('preco').value), categoria: document.getElementById('categoria').value, imagem
    }) });
    form.reset(); await renderAdmin();
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; }
}
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await api('/api/session');
    document.getElementById('admin-content').hidden = false;
    document.getElementById('admin-status').hidden = true;
    await renderAdmin();
  } catch (error) { document.getElementById('admin-status').textContent = 'Acesso indisponível. Use o servidor configurado para administrar o cardápio.'; }
  document.getElementById('logout').addEventListener('click', logout);
  document.getElementById('back').addEventListener('click', voltarIndex);
  document.getElementById('product-form').addEventListener('submit', event => { event.preventDefault(); adicionar(); });
});
