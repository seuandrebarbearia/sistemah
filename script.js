// =========================
// 🔹 CONFIGURAÇÃO
// =========================
const numeroWhatsApp = "5599999999999";
const taxaEntrega = 7;

// =========================
// 🔹 PEGAR PRODUTOS
// =========================
function pegarProdutos() {
  return JSON.parse(localStorage.getItem("produtos")) || [];
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
      <img src="${p.imagem || 'https://via.placeholder.com/150'}" class="img-produto" alt="${p.nome}">
      <h3>${p.nome}</h3>
      <p>${p.descricao || ""}</p>
      <p><strong>R$ ${Number(p.preco).toFixed(2)}</strong></p>
      <button type="button" onclick="abrirOpcoes(${p.id})">Adicionar</button>
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
      ? `<small>${item.opcoes.join(", ")}</small>`
      : "";

    return `
      <div class="item-carrinho">
        <p>
          <span>${quantidade}x ${item.nome}</span>
          <button type="button" onclick="removerItem(${index})">❌</button>
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
      ? ` (${item.opcoes.join(", ")})`
      : "";

    return `
      <p>
        <span>${quantidade}x ${item.nome}${opcoes}</span>
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

  window.open(url, "_blank");

  carrinho = [];
  atualizarCarrinho();
  document.getElementById("checkout-modal").classList.add("hidden");
}

// =========================
// 🔹 INICIAR BOTÕES
// =========================
document.addEventListener("DOMContentLoaded", () => {
  renderProdutos();

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