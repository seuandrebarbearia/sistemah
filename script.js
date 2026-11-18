// =========================
// 🔹 CONFIGURAÇÃO
// =========================
const numeroWhatsApp = "5599999999999";
const taxaEntrega = 7;

// =========================
// 🔹 PEGAR PRODUTOS
// =========================
let catalogo = [];
function pegarProdutos() { return catalogo; }
function lerCatalogoLegado(storage) {
  try {
    const items = JSON.parse(storage.getItem('produtos') || '[]');
    if (!Array.isArray(items)) return [];
    return items.slice(0, 500).filter(item => item &&
      (typeof item.id === 'string' || Number.isSafeInteger(item.id)) &&
      typeof item.nome === 'string' && item.nome.length <= 120 &&
      typeof item.descricao === 'string' && item.descricao.length <= 1000 &&
      Number.isFinite(Number(item.preco)) && Number(item.preco) > 0 &&
      ['lanche', 'bebida'].includes(item.categoria)
    ).map(item => ({ ...item, id: String(item.id), preco: Number(item.preco), imagem: safeImage(item.imagem) }));
  } catch { return []; }
}
async function carregarProdutos() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Catálogo indisponível.');
    const products = await response.json();
    if (!Array.isArray(products)) throw new Error('Catálogo inválido.');
    catalogo = products;
    renderProdutos();
  } catch {
    // Preserve the old device-only catalogue while the secure backend is
    // being configured. It does not authorize any administrative operation.
    try { catalogo = lerCatalogoLegado(window.localStorage); } catch { catalogo = []; }
    renderProdutos();
    const notice = document.createElement('p');
    notice.textContent = 'Catálogo de demonstração deste aparelho. A administração depende do servidor configurado. Confirme preços e disponibilidade com a loja.';
    document.getElementById('lista-produtos').prepend(notice);
  }
}

// =========================
// 🔹 CARRINHO
// =========================
let carrinho = [];
let produtoSelecionado = null;
let quantidadeBebida = 1;

// =========================
// 🔥 SCROLL MENU
// =========================
function scrollPara(id) {
  const el = document.getElementById(id);

  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

// =========================
// 🔥 CARD PRODUTO
// =========================
function cardProduto(p) {
  return `
    <div class="card">
      <img src="${safeImage(p.imagem)}" class="img-produto" alt="${escapeHTML(p.nome)}">
      <h3>${escapeHTML(p.nome)}</h3>
      <p>${escapeHTML(p.descricao || "")}</p>
      <p><strong>R$ ${Number(p.preco).toFixed(2)}</strong></p>
      <button type="button" data-product-id="${escapeHTML(p.id)}">Adicionar</button>
    </div>
  `;
}

// =========================
// 🔥 RENDER PRODUTOS
// =========================
function renderProdutos() {
  const lista = document.getElementById("lista-produtos");
  if (!lista) return;

  const produtos = pegarProdutos();

  const lanches = produtos.filter(p => p.categoria === "lanche");
  const bebidas = produtos.filter(p => p.categoria === "bebida");

  lista.innerHTML = "";

  if (lanches.length > 0) {
    lista.innerHTML += `
      <div class="categoria" id="lanches">
        <h2>🍔 Lanches</h2>
        <div class="produtos-grid">
          ${lanches.map(cardProduto).join("")}
        </div>
      </div>
    `;
  }

  if (bebidas.length > 0) {
    lista.innerHTML += `
      <div class="categoria" id="bebidas">
        <h2>🥤 Bebidas</h2>
        <div class="produtos-grid">
          ${bebidas.map(cardProduto).join("")}
        </div>
      </div>
    `;
  }

  if (produtos.length === 0) {
    lista.innerHTML = "<p>Nenhum produto disponível</p>";
  }
}

// =========================
// 🔥 ABRIR OPÇÕES
// =========================
function abrirOpcoes(id) {
  const produto = pegarProdutos().find(p => p.id === id);

  if (!produto) {
    alert("Produto não encontrado!");
    return;
  }

  produtoSelecionado = produto;

  if (produto.categoria === "lanche") {
    document.getElementById("nome-lanche").textContent = produto.nome;
    limparOpcoesLanche();
    document.getElementById("opcao-modal").classList.remove("hidden");
  }

  if (produto.categoria === "bebida") {
    document.getElementById("nome-bebida").textContent = produto.nome;
    quantidadeBebida = 1;
    marcarQuantidadeBebida();
    document.getElementById("bebida-modal").classList.remove("hidden");
  }
}

// =========================
// 🔥 LIMPAR OPÇÕES LANCHE
// =========================
function limparOpcoesLanche() {
  const ids = [
    "completo",
    "sem-maionese",
    "sem-ketchup",
    "sem-cebola",
    "sem-tomate",
    "sem-alface",
    "sem-milho",
    "sem-ervilha"
  ];

  ids.forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.checked = false;
  });
}

// =========================
// 🔥 PEGAR OPÇÕES DO LANCHE
// =========================
function pegarOpcoesLanche() {
  const opcoes = [];

  function adicionarSeMarcado(id, texto) {
    const campo = document.getElementById(id);
    if (campo && campo.checked) {
      opcoes.push(texto);
    }
  }

  adicionarSeMarcado("completo", "Completo");
  adicionarSeMarcado("sem-maionese", "Sem maionese");
  adicionarSeMarcado("sem-ketchup", "Sem ketchup");
  adicionarSeMarcado("sem-cebola", "Sem cebola");
  adicionarSeMarcado("sem-tomate", "Sem tomate");
  adicionarSeMarcado("sem-alface", "Sem alface");
  adicionarSeMarcado("sem-milho", "Sem milho");
  adicionarSeMarcado("sem-ervilha", "Sem ervilha");

  return opcoes;
}

// =========================
// 🔥 ADICIONAR LANCHE
// =========================
function confirmarLanche() {
  if (!produtoSelecionado) return;

  carrinho.push({
    ...produtoSelecionado,
    quantidade: 1,
    opcoes: pegarOpcoesLanche()
  });

  document.getElementById("opcao-modal").classList.add("hidden");
  atualizarCarrinho();
}

// =========================
// 🔥 BEBIDA
// =========================
function marcarQuantidadeBebida() {
  document.querySelectorAll(".opcao-qtd").forEach(opcao => {
    const qtd = Number(opcao.dataset.qtd);
    opcao.classList.toggle("ativo", qtd === quantidadeBebida);
  });
}

function confirmarBebida() {
  if (!produtoSelecionado) return;

  carrinho.push({
    ...produtoSelecionado,
    quantidade: quantidadeBebida,
    opcoes: []
  });

  document.getElementById("bebida-modal").classList.add("hidden");
  atualizarCarrinho();
}

// =========================
// 🔥 CARRINHO
// =========================
function abrirCarrinho() {
  atualizarCarrinho();
  document.getElementById("cart-modal").classList.remove("hidden");
}

function fecharCarrinho() {
  document.getElementById("cart-modal").classList.add("hidden");
}

function atualizarCarrinho() {
  const cartItems = document.getElementById("cart-items");
  const total = document.getElementById("total");

  if (!cartItems || !total) return;

  if (carrinho.length === 0) {
    cartItems.innerHTML = "<p>Seu carrinho está vazio.</p>";
    total.textContent = "Total: R$ 0.00";
    return;
  }

  cartItems.innerHTML = carrinho.map((item, index) => {
    const quantidade = item.quantidade || 1;
    const subtotal = Number(item.preco) * Number(quantidade);
    const opcoes = item.opcoes && item.opcoes.length > 0
      ? `<small>${item.opcoes.map(escapeHTML).join(", ")}</small>`
      : "";

    return `
      <div class="item-carrinho">
        <p>
          <span>${quantidade}x ${escapeHTML(item.nome)}</span>
          <button type="button" data-remove-index="${index}">❌</button>
        </p>
        ${opcoes}
        <p><strong>R$ ${subtotal.toFixed(2)}</strong></p>
      </div>
    `;
  }).join("");

  total.textContent = `Total: R$ ${calcularTotal().toFixed(2)}`;
}

function removerItem(index) {
  carrinho.splice(index, 1);
  atualizarCarrinho();
}

function calcularTotal() {
  return carrinho.reduce((total, item) => {
    return total + Number(item.preco) * Number(item.quantidade || 1);
  }, 0);
}

// =========================
// 🔥 FINALIZAR PEDIDO
// =========================
function abrirCheckout() {
  if (carrinho.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  const resumo = document.getElementById("resumo-pedido");
  const totalFinal = document.getElementById("total-final");
  const totalPedido = calcularTotal() + taxaEntrega;

  resumo.innerHTML = carrinho.map(item => {
    const quantidade = item.quantidade || 1;
    const opcoes = item.opcoes && item.opcoes.length > 0
      ? ` (${item.opcoes.map(escapeHTML).join(", ")})`
      : "";

    return `
      <p>
        <span>${quantidade}x ${escapeHTML(item.nome)}${opcoes}</span>
        <strong>R$ ${(Number(item.preco) * Number(quantidade)).toFixed(2)}</strong>
      </p>
    `;
  }).join("");

  totalFinal.textContent = `Total: R$ ${totalPedido.toFixed(2)}`;

  document.getElementById("cart-modal").classList.add("hidden");
  document.getElementById("checkout-modal").classList.remove("hidden");
}

function confirmarPedido() {
  const nome = document.getElementById("nome-cliente").value.trim();
  const telefone = document.getElementById("telefone").value.trim();
  const endereco = document.getElementById("endereco").value.trim();
  const numero = document.getElementById("numero").value.trim();
  const complemento = document.getElementById("complemento").value.trim();
  const bairro = document.getElementById("bairro").value.trim();

  if (!nome || !telefone || !endereco || !numero || !bairro) {
    alert("Preencha nome, telefone, endereço, número e bairro.");
    return;
  }

  const totalPedido = calcularTotal() + taxaEntrega;

  let mensagem = "🍔 *Novo Pedido - Seu André Burguer*\n\n";

  mensagem += "*Itens do pedido:*\n";

  carrinho.forEach(item => {
    const quantidade = item.quantidade || 1;
    const subtotal = Number(item.preco) * Number(quantidade);

    mensagem += `• ${quantidade}x ${item.nome} - R$ ${subtotal.toFixed(2)}\n`;

    if (item.opcoes && item.opcoes.length > 0) {
      mensagem += `  Obs: ${item.opcoes.join(", ")}\n`;
    }
  });

  mensagem += `\n*Taxa de entrega:* R$ ${taxaEntrega.toFixed(2)}\n`;
  mensagem += `*Total:* R$ ${totalPedido.toFixed(2)}\n\n`;

  mensagem += "*Dados do cliente:*\n";
  mensagem += `Nome: ${nome}\n`;
  mensagem += `Telefone: ${telefone}\n`;
  mensagem += `Endereço: ${endereco}, Nº ${numero}\n`;

  if (complemento) {
    mensagem += `Complemento: ${complemento}\n`;
  }

  mensagem += `Bairro: ${bairro}\n`;

  const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;

  window.open(url, "_blank", "noopener,noreferrer");

  carrinho = [];
  atualizarCarrinho();
  document.getElementById("checkout-modal").classList.add("hidden");
}

// =========================
// 🔹 INICIAR BOTÕES
// =========================
document.addEventListener("DOMContentLoaded", () => {
  carregarProdutos();
  document.querySelectorAll('[data-scroll]').forEach(button => button.addEventListener('click', () => scrollPara(button.dataset.scroll)));
  document.getElementById('lista-produtos').addEventListener('click', event => {
    const button = event.target.closest('[data-product-id]');
    if (button) abrirOpcoes(button.dataset.productId);
  });
  document.getElementById('cart-items').addEventListener('click', event => {
    const button = event.target.closest('[data-remove-index]');
    if (button) removerItem(Number(button.dataset.removeIndex));
  });

  document.getElementById("cart-btn")?.addEventListener("click", abrirCarrinho);
  document.getElementById("fechar")?.addEventListener("click", fecharCarrinho);
  document.getElementById("finalizar")?.addEventListener("click", abrirCheckout);

  document.getElementById("confirmar")?.addEventListener("click", confirmarPedido);
  document.getElementById("fechar-checkout")?.addEventListener("click", () => {
    document.getElementById("checkout-modal").classList.add("hidden");
  });

  document.getElementById("confirmar-opcao")?.addEventListener("click", confirmarLanche);
  document.getElementById("fechar-opcao")?.addEventListener("click", () => {
    document.getElementById("opcao-modal").classList.add("hidden");
  });

  document.getElementById("confirmar-bebida")?.addEventListener("click", confirmarBebida);
  document.getElementById("fechar-bebida")?.addEventListener("click", () => {
    document.getElementById("bebida-modal").classList.add("hidden");
  });

  document.querySelectorAll(".opcao-qtd").forEach(opcao => {
    opcao.addEventListener("click", () => {
      quantidadeBebida = Number(opcao.dataset.qtd);
      marcarQuantidadeBebida();
    });
  });
});
