# CLAUDE.md — Projeto Mercadinho (Controle de Estoque do Mercadinho Seu João)

> Leia este arquivo inteiro antes de qualquer tarefa. Ele é a fonte de verdade do projeto.

## 1. O que é
Software simples de controle de estoque para o Mercadinho Seu João. Mostra quanto existe de cada produto, o que está acabando e o que está perto de vencer.
Projeto acadêmico (SI / UX-UI), com prazo e equipe limitados. Versão 1.0 dos requisitos: 02/10/2026.

**Problema:** o estoque hoje é controlado de memória, planilhas e papel. Resultado: perda por validade, falta de mercadoria, compras desnecessárias e retrabalho.

## 2. Regras para a IA (SEMPRE seguir)
- Faça uma tarefa pequena por vez e explique o que alterou.
- Não apague nem reescreva arquivos que não foram citados no pedido.
- Mantenha o padrão de código e de nomes já usado no projeto.
- Não instale bibliotecas novas nem mude o stack sem avisar e pedir confirmação.
- **Não adicione funcionalidades fora do escopo** (ver seção 3).
- Se algo não estiver claro ou estiver em "Pontos em aberto" (seção 9), pergunte antes de assumir.
- Interface sempre em português (Brasil), datas em dd/mm/aaaa, linguagem do cotidiano, sem termos técnicos para o usuário.
- Nunca coloque chaves do Supabase, senhas ou segredos no código versionado (usar variáveis de ambiente / `.env` fora do Git).
- Ao fim de cada sessão, atualize a seção "Estado atual" (seção 11).

## 3. Escopo
**Dentro da v1:** cadastro de produtos, entradas e saídas, consulta de estoque, validade por lote, alertas (estoque baixo e validade próxima), relatórios.

**Fora da v1 (NÃO implementar):** controle financeiro, caixa, pagamentos, serviços, campanhas, leitor de código de barras, NF-e. O mercadinho aceita só dinheiro, então não há valores financeiros no sistema. Não buscamos sistema empresarial avançado.

**Filtro para novas ideias:**
1. Ajuda a saber quanto há de um produto, o que está acabando ou o que vai vencer? Se não, fica para versão futura.
2. Uma pessoa sem conhecimento técnico consegue usar sem treinamento?
3. Cabe no cronograma sem atrasar o fim do desenvolvimento em 13/11?

## 3.1 Usuários
| Perfil | Papel | Precisa de |
|---|---|---|
| Dono (Seu João) | Decide compras, acompanha perdas | Visão geral, alertas, relatórios, gestão de usuários e cadastros |
| Funcionário | Recebe mercadorias e baixa saídas | Registrar entradas/saídas rápido, consultar estoque, ver avisos |

Tipos no banco: `DONO` e `FUNCIONARIO`.

## 4. Stack e restrições
- **Telas:** HTML + CSS (protótipo no Figma), acessado via navegador.
- **Back-end:** Python (validação de estoque mínimo, regra FEFO, verificação de validade, geração de alertas).
- **Banco:** Supabase (PostgreSQL), comunicação por HTTP/HTTPS.
- **Código:** Git + GitHub (repositórios de front-end e back-end; não versiona dados do banco).
- **Proibido nesta fase:** FastAPI, SQLAlchemy, Docker.
- Código em camadas: apresentação / lógica / dados.
- Navegadores: Chrome, Edge, Firefox no computador; responsivo para celular/tablet é desejável.

## 5. Fluxo principal
Início → Login → Menu Principal → [Produtos | Entradas | Saídas | Consultas | Relatórios] → Atualizar Estoque → Alertas → (Estoque Baixo | Validade Próxima) → Exibir Aviso.
Observação: Entradas (e Ajustes) também atualizam o estoque, e os alertas devem persistir e reaparecer a cada acesso.

## 6. Regras de negócio
- **RN01** Estoque atual NÃO é guardado no produto; é calculado pelas movimentações (entradas − saídas ± ajustes).
- **RN02** Toda movimentação (ENTRADA, SAIDA, AJUSTE) registra produto, usuário, quantidade e data/hora.
- **RN03** ENTRADA e SAIDA exigem lote; AJUSTE ainda a definir.
- **RN04** Baixa segue **FEFO**: sai primeiro o lote com validade mais próxima.
- **RN05** Proibido estoque negativo.
- **RN06** Estoque baixo = estoque atual ≤ estoque mínimo do produto.
- **RN07** Validade próxima = lote com saldo > 0 e validade dentro de X dias (X configurável).
- **RN08** Produtos, categorias, fornecedores e usuários são **inativados, nunca excluídos**.
- **RN09** Únicos: nome da categoria, login do usuário, código de barras.
- **RN10** Só o Dono gerencia usuários e faz ajustes de estoque.
- **RN11** Sem valores financeiros nesta versão.

## 7. Requisitos funcionais (resumo)
Prioridade: E = Essencial, I = Importante, D = Desejável.

- **Acesso (RF01–05):** login/senha (E), perfis Dono/Funcionário com restrição de funções (E), Dono gerencia usuários (I), logout (E), bloquear login de inativos (E).
- **Cadastros (RF06–11):** produto com nome, categoria, código de barras (opcional), unidade e estoque mínimo (E); editar/inativar sem excluir (E); barrar código de barras duplicado (E); categorias (I); fornecedores com nome, telefone, e-mail (I); flag perecível que exige validade na entrada (I).
- **Entradas (RF12–15):** registrar produto, quantidade, fornecedor, data de entrada e validade (E); cada entrada gera/acrescenta lote (E); registrar usuário, data/hora e observação (E); vários lotes do mesmo produto (E).
- **Saídas (RF16–21):** registrar produto e quantidade (E); baixa automática FEFO (E); impedir saída maior que o disponível (E); motivo da saída: venda, perda, vencimento, avaria (I); registrar usuário e data/hora (E); ajuste com justificativa obrigatória, só Dono (I).
- **Consulta (RF22–26):** estoque atual calculado (E); busca por nome, código de barras e categoria (E); lotes com quantidade e validade (E); destaque visual de baixo/vencendo (I); histórico de movimentações (I).
- **Alertas (RF27–33):** ESTOQUE_BAIXO (E); VALIDADE_PROXIMA (E); lote vencido com saldo (I); exibir no painel e atalhos no menu, com visualizado/não visualizado (E); reavaliar a cada movimentação e ao iniciar o dia/login (E); desativar quando a condição deixa de existir (I); não duplicar alertas ativos do mesmo produto/lote/tipo (I).
- **Relatórios (RF34–38):** estoque atual por produto/categoria (E); estoque baixo / reposição sugerida (E); próximos do vencimento e vencidos (E); movimentações por período, tipo e usuário (I); exportar PDF/CSV (D).
- **Menu (RF39):** atalhos para Produtos, Entradas, Saídas, Consultas e Relatórios, mais resumo de alertas (E).

## 8. Requisitos não funcionais
- Interface simples, poucos cliques; registrar entrada ou saída em menos de 1 minuto.
- Fontes e contraste legíveis; alertas distintos por cor **e** texto.
- Senhas com hash (nunca texto puro); HTTPS; controle de acesso por perfil.
- Chaves estrangeiras com `ON DELETE`/`ON UPDATE` definidos para não apagar histórico.
- Telas principais respondem em até 3 s (centenas a poucos milhares de produtos/lotes).
- Depende de internet (Supabase): falha de conexão deve mostrar mensagem clara.
- Operações de estoque atômicas (movimentação + lote na mesma transação).

## 9. Banco de dados (Supabase / PostgreSQL)
- **USUARIO:** id_usuario PK, nome, login (UNIQUE), senha (hash), tipo (DONO/FUNCIONARIO), ativo.
- **CATEGORIA:** id_categoria PK, nome (UNIQUE), descricao, ativo.
- **PRODUTO:** id_produto PK, id_categoria FK, nome, codigo_barras (UNIQUE, opcional), unidade_medida, estoque_minimo DECIMAL(10,2), ativo. *Sem estoque_atual.*
- **FORNECEDOR:** id_fornecedor PK, nome, telefone, email, ativo.
- **LOTE:** id_lote PK, id_produto FK, id_fornecedor FK, data_entrada, data_validade, quantidade DECIMAL(10,2).
- **MOVIMENTACAO:** id_movimentacao PK, id_produto FK, id_lote FK, id_usuario FK, tipo (ENTRADA/SAIDA/AJUSTE), quantidade DECIMAL(10,2), data_movimentacao, observacao.
- **ALERTA:** id_alerta PK, id_produto FK, id_lote FK (NULL), tipo (ESTOQUE_BAIXO/VALIDADE_PROXIMA), mensagem, data_geracao, visualizado, ativo.

Relações: CATEGORIA 1:N PRODUTO; PRODUTO 1:N LOTE; FORNECEDOR 1:N LOTE; PRODUTO 1:N MOVIMENTACAO; LOTE 1:N MOVIMENTACAO; USUARIO 1:N MOVIMENTACAO; PRODUTO 1:N ALERTA; LOTE 1:N ALERTA.

## 10. Pontos em aberto (NÃO decidir sozinho, perguntar)
1. Trocar "Caixa" por "Funcionário" no diagrama de arquitetura e renomear telas (ex.: Produtos · Movimentações · Alertas).
2. `LOTE.quantidade` é a quantidade recebida (fixa) ou o saldo atual? Como calcular o saldo do lote?
3. Como tratar AJUSTE sem lote (`id_lote` obrigatório hoje).
4. Prazo de "validade próxima" (7, 15 ou 30 dias?), onde configurar, se varia por categoria.
5. `data_validade` deve ser opcional para não perecíveis.
6. Venda a granel (kg/litros) ou só por unidade? (DECIMAL(10,2) já suporta ambos.)
7. O que o Funcionário pode fazer (cadastrar produto, ajustar estoque, ver relatórios)?
8. Quem cria usuários e como redefinir senha.
9. Reposição: tratar como relatório "produtos a repor" (RF35), sem módulo de compras.
10. Quais relatórios o cliente realmente quer.
11. Servidor web para o Python falar com o HTML via HTTP (ex.: Flask). Decidir antes de implementar.
12. Quando gerar alertas: rotina periódica, a cada movimentação ou a cada login.
13. Carga inicial do estoque: cadastro manual, importação CSV ou ambos.

## 11. Cronograma
| Data | Semana | Entregas |
|---|---|---|
| 02/10 | 1 (marco) | Apresentação do cronograma e protótipo de tela; revisão de requisitos; equipe; Git e banco |
| 09/10 | 2 | Modelagem final do banco; tabelas; testes iniciais; protótipos das telas |
| 16/10 | 3 | Telas e navegação; estrutura do front-end |
| 23/10 | 4 | Login, cadastro de produtos, integração com o banco |
| 30/10 | 5 | Entrada e saída de mercadorias; testes das movimentações |
| 06/11 | 6 | Alertas automáticos, painel principal, relatórios |
| 13/11 | 7 (marco) | **Fim do desenvolvimento**: testes gerais, correções, ajustes visuais |
| 20/11 | 8 | Documentação final e organização do repositório |
| 27/11 | 9 (marco) | Reserva para ajustes e **apresentação final** |

Prioridade de corte (MoSCoW): **Must** = RF01, 02, 04–08, 12–18, 20, 22–24, 27, 28, 30, 31, 34–36, 39. Se faltar tempo, corte primeiro os Should/Could (RF38, responsivo completo, prazos por categoria).

## 12. Estado atual (atualizar ao fim de cada sessão)
- **Feito:** Padronização visual das telas internas em HTML, CSS e JavaScript; navegação entre telas funcionando; criação dos fluxos de produtos, entradas, saídas, painel e relatórios; remoção de todos os dados fictícios e textos simulados; substituição por estados vazios e placeholders profissionais; criação da estrutura de integração em services/api para receber o backend Python; comentários de encaixe para rotas, autenticação, relatórios e regra FEFO no backend; criação da base backend Flask em `app.py` com endpoints reais de saúde, autenticação, produtos, movimentações, alertas e relatórios; validação real de conexão com o Supabase usando a chave correta do ambiente; implementação dos popups de novo produto, nova movimentação, nova entrada e nova saída com envio real para o backend; registro e validação de produtos e movimentações diretamente no Supabase; autenticação restrita a usuários reais do banco; testes de regressão cobrindo login, cadastro de produto, entradas/saídas e bloqueio de saída sem estoque; preenchimento dos cards de estatísticas e relatórios com dados reais vindos da API e do banco; correção da leitura duplicada de JSON nos scripts do frontend para evitar que os valores ficassem vazios ou quebrassem a renderização.
- **Em andamento:** Ajustes finos de UX dos formulários e refinamento de regras de estoque/alertas conforme a demanda real do cliente.
- **Próximos passos:** Confirmar em uso real junto ao cliente a regra de validade próxima, se os funcionários podem ou não cadastrar produtos, e expandir alertas e relatórios conforme a operação do mercadinho.
- **Decisões tomadas desde a v1.0:** Mantida a stack inicial em HTML + CSS + JavaScript; dados inventados foram removidos para evitar risco de falseamento; a camada de API foi preparada em services/api com client, products, movements, alerts e reports; o protótipo ficou pronto para receber dados do backend sem exigir refatoração visual; filtros, busca e ações permaneceram funcionais mesmo com estados vazios; o backend foi implementado em Flask para atender ao escopo do projeto e explorar o Supabase com credenciais reais; os formulários agora gravam dados reais diretamente nas tabelas do Supabase; a validação de estoque já impede saída maior que o disponível; os painéis e relatórios passam a consumir valores calculados dinâmicos a partir do banco em tempo real.

## 13. Perguntas para validar com o Seu João
1. Quantos produtos e funcionários existem? Com que frequência chegam mercadorias?
2. Com quantos dias de antecedência quer aviso de vencimento? Varia por tipo de produto?
3. O que o funcionário pode ou não fazer?
4. Usa código de barras? Tem leitor?
5. Vende a granel?
6. O que precisa ver no relatório para decidir uma compra?
7. Qual dispositivo usará (computador, celular, ambos)?
8. O que acontece hoje com produto vencido (perda, devolução)? Precisa registrar?