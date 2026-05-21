// =========================
// 🔐 VERIFICAR LOGIN
// =========================
if (localStorage.getItem("logado") !== "true") {
  window.location.href = "login.html";
}

// =========================
// 🔙 VOLTAR PARA A PÁGINA INICIAL
// =========================
function voltarIndex() {
  window.location.href = "index.html";
}

// =========================
// 🔐 SAIR DO ADMIN
// =========================
function logout() {
  localStorage.removeItem("logado");
  window.location.href = "index.html";
}

// =========================
// 🔹 PEGAR PRODUTOS
// =========================
function pegarProdutos() {
  return JSON.parse(localStorage.getItem("produtos")) || [];
}

// =========================
// 🔹 SALVAR PRODUTOS
// =========================
function salvarProdutos(produtos) {
  localStorage.setItem("produtos", JSON.stringify(produtos));
}

// =========================
// 🔥 ADICIONAR PRODUTO
// =========================
function adicionar() {
  const nome = document.getElementById("nome").value.trim();
  const descricao = document.getElementById("descricao").value.trim();
  const preco = Number(document.getElementById("preco").value);
  const categoria = document.getElementById("categoria").value;
  const imagemInput = document.getElementById("imagem");

  if (!nome || !descricao || !preco || !categoria) {
    alert("Preencha nome, descrição, preço e categoria.");
    return;
  }

  const produtos = pegarProdutos();

  const novoProduto = {
    id: Date.now(),
    nome: nome,
    descricao: descricao,
    preco: preco,
    categoria: categoria,
    imagem: ""
  };

  const arquivoImagem = imagemInput.files[0];

  if (arquivoImagem) {
    const reader = new FileReader();

    reader.onload = function () {
      novoProduto.imagem = reader.result;
      produtos.push(novoProduto);
      salvarProdutos(produtos);
      limparFormulario();
      renderAdmin();
      alert("Produto adicionado com sucesso!");
    };

    reader.readAsDataURL(arquivoImagem);
  } else {
    produtos.push(novoProduto);
    salvarProdutos(produtos);
    limparFormulario();
    renderAdmin();
    alert("Produto adicionado com sucesso!");
  }
}

// =========================
// 🔥 LIMPAR FORMULÁRIO
// =========================
function limparFormulario() {
  document.getElementById("nome").value = "";
  document.getElementById("descricao").value = "";
  document.getElementById("preco").value = "";
  document.getElementById("categoria").value = "";
  document.getElementById("imagem").value = "";
}

// =========================
// 🔥 MOSTRAR PRODUTOS NO ADMIN
// =========================
function renderAdmin() {
  const lista = document.getElementById("lista-admin");

  if (!lista) return;

  const produtos = pegarProdutos();

  if (produtos.length === 0) {
    lista.innerHTML = "<p>Nenhum produto cadastrado.</p>";
    return;
  }

  lista.innerHTML = produtos.map(produto => `
    <div class="card">
      <img src="${produto.imagem || 'https://via.placeholder.com/150'}" class="img-produto" alt="${produto.nome}">
      <h3>${produto.nome}</h3>
      <p>${produto.descricao}</p>
      <p><strong>R$ ${Number(produto.preco).toFixed(2)}</strong></p>
      <p>${produto.categoria}</p>
      <button type="button" onclick="excluirProduto(${produto.id})">Excluir</button>
    </div>
  `).join("");
}

// =========================
// 🔥 EXCLUIR PRODUTO
// =========================
function excluirProduto(id) {
  const produtos = pegarProdutos().filter(produto => produto.id !== id);

  salvarProdutos(produtos);
  renderAdmin();
}

// =========================
// 🔹 INICIAR
// =========================
document.addEventListener("DOMContentLoaded", () => {
  renderAdmin();
});