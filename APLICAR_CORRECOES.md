# Como entregar estas correções ao Antigravity

Este ZIP preserva os caminhos relativos à raiz `PAIEMAE` e substitui o pacote anterior `revisao-instagram-paiemae.zip`. Foi montado com barras `/` normais para extrair corretamente no Windows.

1. No projeto local, confirme que alterações anteriores estão salvas (por exemplo, com `git status`). Extraia o ZIP em uma pasta separada e peça ao Antigravity para comparar e incorporar estes arquivos ao projeto, preservando outras mudanças locais.
2. Peça para rodar `node test_full_suite.mjs`, `npx eslint src/pages/Marketing.jsx src/pages/CrmInteressados.jsx src/components/marketing src/services/instagramService.js src/services/supabaseService.js api/instagram.js api/instagram-webhook.js vite.config.js test_full_suite.mjs` e `npm run build`.
3. Leia `RESUMO_TESTES.md` antes de executar a migração, configurar a Meta e publicar. Não use o script de testes antigo, que criava registros no banco remoto.
4. Não copie `.env` nem credenciais para o projeto ou para o chat. Configure as variáveis privadas diretamente no ambiente das funções do backend.

Não executei SQL, push, deploy ou chamadas reais à Meta neste trabalho.
