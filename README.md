# Sistemah: administração validada no servidor

O login antigo confiava em `localStorage.logado` e comparava um hash MD5 no navegador. Agora o servidor valida a senha com scrypt, emite uma sessão aleatória em cookie HttpOnly, Secure e SameSite=Strict e exige essa sessão para cadastrar ou excluir produtos. A sessão expira em duas horas; sair ou reiniciar o servidor a invalida.

## Executar e publicar

Requer Node.js 22 ou superior, HTTPS e uma única instância do servidor. GitHub Pages não executa este backend. Se os arquivos forem publicados apenas como páginas estáticas, o painel permanece bloqueado e não há fallback de login local.

1. Escolha uma senha nova, diferente da senha antiga exposta no frontend, com pelo menos 12 caracteres. Envie-a pela entrada padrão para `npm run password-hash --silent`. Não passe a senha como argumento e não a salve no repositório.
2. Nas variáveis privadas da hospedagem, configure `ADMIN_PASSWORD_HASH` com o resultado, `PUBLIC_ORIGIN` com a origem HTTPS exata (por exemplo `https://cardapio.exemplo.com`) e `PORT` conforme necessário.
3. Execute `npm start`. O processo escuta em `127.0.0.1`; configure o proxy HTTPS da hospedagem para encaminhar para essa porta. Preserve o diretório `data/` em um volume persistente e faça backups. Não exponha esse diretório pelo proxy.
4. Para desenvolvimento local somente, use `NODE_ENV=development` e `PUBLIC_ORIGIN=http://localhost:3000`; o cookie local não recebe Secure. Nunca use essa configuração em produção.
5. Execute `npm test` para validar as principais barreiras de acesso.

Os produtos antigos existiam somente no navegador que os cadastrou. Eles não são importados automaticamente: confira e recadastre os itens pelo painel autenticado. Não há catálogo padrão inventado. Configure também o número real do WhatsApp em `script.js`; o projeto original contém um número demonstrativo.

Enquanto o backend não estiver configurado, a versão estática mantém somente a leitura do catálogo legado deste aparelho, com validação dos registros e escape dos campos. Exibe um aviso de demonstração e não permite cadastrar ou excluir produtos pelo antigo login. O cache antigo não é apagado. Isso permite fechar a entrada administrativa insegura sem descartar o catálogo existente.

## Proteções e limites

- Validação de sessão no servidor em cada alteração e antes de servir `admin.html`.
- Verificação de Origin em alterações e bloqueio de tentativas repetidas de senha.
- Catálogo central em arquivo persistente, com gravação atômica; dados privados e código do servidor fora das rotas públicas.
- Campos renderizados como texto ou escapados; imagens limitadas a PNG, JPEG e WebP; política de conteúdo sem scripts inline.
- Uma instância e um administrador. Escala horizontal exige um banco e armazenamento de sessões compartilhados. O limite por IP usa o endereço do socket; atrás de um proxy ele pode ser compartilhado entre visitantes.
- Pedido pelo WhatsApp é uma solicitação: a loja deve conferir valores e disponibilidade antes de aceitar. O navegador não é uma autoridade para preços ou pagamento.

As verificações cobrem o código desta alteração. Não validam a configuração efetiva da hospedagem nem constituem uma auditoria completa.
