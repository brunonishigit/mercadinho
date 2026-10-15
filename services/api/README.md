# Camada de integração da API

Este diretório foi preparado para receber a comunicação com o backend em Python.

## Estrutura prevista
- `client.js` - cliente HTTP para chamar as rotas do backend.
- `products.js` - CRUD de produtos.
- `movements.js` - entradas, saídas e ajustes de estoque.
- `alerts.js` - geração e consulta de alertas.
- `reports.js` - relatórios e exportações.
- `types.js` - modelos compartilhados.

## Padrão de integração
- Buscar dados via `fetch` para rotas Python.
- Tratar `loading`, `error` e `empty state` no front-end.
- Usar autenticação e token quando a API estiver pronta.
- Manter regras de negócio no backend: FEFO, validação de estoque mínimo e alertas.

## Pontos de encaixe do projeto
- A tela de `Produtos` deve consumir a rota de listagem de produtos.
- A tela de `Entradas` deve consumir a rota de movimentação por tipo `ENTRADA`.
- A tela de `Saídas` deve consumir a rota de movimentação por tipo `SAIDA`.
- O `Painel` deve consultar resumo geral e alertas ativos.
- O `Relatórios` deve consumir dados agregados por categoria, validade e histórico.

## Observação importante
Os dados atuais foram removidos do protótipo para evitar mock e manter a interface limpa.
O frontend ficou pronto para receber dados reais do Python assim que a API e o banco estiverem conectados.
