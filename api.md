## APIs Externas Utilizadas

Este documento resume as integrações externas da aplicação, agrupadas por **tipo de uso** e com indicação de **autenticação** quando aplicável.

---

## Fontes de leads (licitações, contratos, convênios e cadastros públicos)

### Querido Diário
- **URL base**: `https://api.queridodiario.ok.org.br`
- **Arquivo**: `src/services/data-sources/diario-oficial.source.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Busca e processa publicações de Diários Oficiais municipais/estaduais, extraindo CNPJs/CPFs de trechos de texto para gerar leads (PJ e PF) a partir de atos oficiais (licitações, PAD, etc.).

### PNCP – Pesquisa de Licitações
- **URL base**: `https://pncp.gov.br/api/search`
- **Arquivos**: `src/services/pncp-search.service.ts`, `src/services/email-search.service.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Pesquisa licitações (documentos do tipo edital) no PNCP, com filtros por UF, datas e status. Os resultados são usados para encontrar licitações com resultado e, a partir delas, localizar fornecedores e enriquecer contatos (inclusive para busca de e‑mails).

### PNCP – Consulta (Contratações e Contratos)
- **URL base**: `https://pncp.gov.br/api/consulta/v1`
- **Arquivos**: `src/services/pncp-consulta.service.ts`, `src/services/data-sources/pncp-contratos.source.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: 
  - Endpoint de contratações: lista publicações de contratações por intervalo de datas, modalidade e UF.
  - Endpoint de contratos: lista contratos firmados em determinado período, com paginação e, opcionalmente, filtro por UF.
  - A fonte `PncpContratosSource` usa a API de contratos para extrair CNPJs de fornecedores PJ, valores globais e UF/município do órgão, gerando leads a partir de contratos públicos.

### PNCP – Integração (Itens e Resultados)
- **URL base**: `https://pncp.gov.br/api/pncp/v1`
- **Arquivo**: `src/services/pncp-integration.service.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Consulta itens de compras e seus resultados (fornecedores vencedores) a partir de órgão, ano e número sequencial de compra. É usado para obter, em lote, o detalhamento de resultados de licitações (itens, vencedores, valores).

### TCU – Certidões APF
- **URL base**: `https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes`
- **Arquivo**: `src/services/data-sources/tcu.source.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Verifica CNPJs de leads existentes na base contra as certidões do TCU (Inidôneos, Improbidade, etc.). Não gera novos leads; apenas identifica empresas com problemas (situação diferente de "NADA_CONSTA") e enriquece com e‑mail/telefone via serviços de CNPJ.

### TCE-RJ – Dados de Contratos
- **URL**: `https://dados.tcerj.tc.br/api/v1/contratos`
- **Arquivo**: `src/services/data-sources/tce-rj.source.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Busca contratos registrados no TCE-RJ, extrai CNPJs de credores (fornecedores) PJ e valor de contrato, gera leads para o estado do Rio de Janeiro e depois enriquece com dados de contato via CNPJ.

### TCE-SP – Transparência (Despesas Municipais)
- **URL base**: `https://transparencia.tce.sp.gov.br/api/json`
- **Arquivo**: `src/services/data-sources/tce-sp.source.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Consulta despesas municipais em grandes municípios paulistas. A partir das despesas, extrai CNPJs de fornecedores (id_fornecedor) e valores, gera leads de empresas que fornecem para esses municípios e enriquece com dados de contato.

### SICAF – Compras Governamentais
- **URL**: `https://compras.dados.gov.br/fornecedores/v1/fornecedores.json`
- **Arquivo**: `src/services/data-sources/sicaf.source.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Lista fornecedores cadastrados no SICAF filtrando por UF. Filtra apenas PJ (tem CNPJ) e gera leads com CNPJ, razão social e UF, depois enriquecidos com e‑mail/telefone via serviços de CNPJ.

### Portal da Transparência – Convênios (TransfereGov)
- **URL**: `https://api.portaldatransparencia.gov.br/api-de-dados/convenios`
- **Arquivo**: `src/services/data-sources/transparencia.source.ts`
- **Autenticação**: header `chave-api-dados` com `PORTAL_TRANSPARENCIA_KEY`
- **Variáveis de ambiente**: `PORTAL_TRANSPARENCIA_KEY`
- **Uso**: Busca convênios em período de datas e, opcionalmente, por UF. Foco em identificar consórcios públicos intermunicipais (nome/tipo contendo "consorcio"), gerando leads com CNPJ, razão social, UF, município e valores de convênio, enriquecidos depois com e‑mail/telefone via CNPJ.

### Portal da Transparência – CEIS
- **URL**: `https://api.portaldatransparencia.gov.br/api-de-dados/ceis`
- **Arquivo**: `src/services/data-sources/ceis.source.ts`
- **Autenticação**: header `chave-api-dados` com `PORTAL_TRANSPARENCIA_KEY`
- **Variáveis de ambiente**: `PORTAL_TRANSPARENCIA_KEY`
- **Uso**: Lista empresas sancionadas/inidôneas (PJ) a partir do CEIS. Extrai CNPJs, razão social e UF do órgão sancionador, gera leads de risco (empresas sancionadas) e enriquece com e‑mail/telefone via CNPJ.

### Portal da Transparência – CNEP
- **URL**: `https://api.portaldatransparencia.gov.br/api-de-dados/cnep`
- **Arquivo**: `src/services/data-sources/cnep.source.ts`
- **Autenticação**: header `chave-api-dados` com `PORTAL_TRANSPARENCIA_KEY`
- **Variáveis de ambiente**: `PORTAL_TRANSPARENCIA_KEY`
- **Uso**: Lista empresas punidas (PJ) no CNEP, extraindo CNPJ, razão social e UF. Gera leads de risco (empresas punidas) e enriquece com contatos via serviços de CNPJ.

---

## Enriquecimento de CNPJ (dados cadastrais, e‑mail e telefone)

### BrasilAPI – CNPJ
- **URL**: `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
- **Arquivo**: `src/services/cnpj-lookup.service.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Fonte principal e rápida de dados cadastrais de empresas (razão social, endereço, CNAE, situação cadastral). Não fornece e‑mails confiáveis, mas fornece telefones básicos, UF, município e descrição de atividade.

### CNPJá (open.cnpja.com)
- **URL**: `https://open.cnpja.com/office/{cnpj}`
- **Arquivo**: `src/services/cnpj-lookup.service.ts`
- **Autenticação**: pública (sem chave) na versão open usada aqui
- **Uso**: Fonte prioritária de e‑mail e telefones de empresas, com dados ricos (nome, endereço, CNAE). Usada tanto em consultas individuais quanto em lote para enriquecer CNPJs com contatos de boa qualidade (categoria "empresa").

### CNPJ.ws (publica.cnpj.ws)
- **URL**: `https://publica.cnpj.ws/cnpj/{cnpj}`
- **Arquivo**: `src/services/cnpj-lookup.service.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Fonte alternativa de e‑mail e telefones corporativos. Complementa dados de razão social, nome fantasia, município, UF e CNAE principal quando BrasilAPI/CNPJá não cobrem todos os campos.

### ReceitaWS
- **URL**: `https://receitaws.com.br/v1/cnpj/{cnpj}`
- **Arquivo**: `src/services/cnpj-lookup.service.ts`
- **Autenticação**: pública, porém com limites fortes de uso
- **Uso**: Fallback de último recurso para obter e‑mails/telefones quando outros provedores não trazem dados. Costuma retornar e‑mails de contabilidade; usado com menor prioridade na classificação de e‑mail.

### OpenCNPJ
- **URL**: `https://api.opencnpj.org/{cnpj}`
- **Arquivo**: `src/services/cnpj-lookup.service.ts`
- **Autenticação**: pública (sem chave)
- **Uso**: Fonte secundária de telefones e, quando disponível, e‑mail, com alta taxa de requisições permitida. Também fornece razão social, nome fantasia, município, UF e CNAE principal; é usada em paralelo com BrasilAPI e como complemento de dados.

### SerpAPI – Google Maps
- **URL**: `https://serpapi.com/search.json`
- **Arquivo**: `src/services/google-places.service.ts`
- **Autenticação**: query param `api_key` com `SERPAPI_KEY`
- **Variáveis de ambiente**: `SERPAPI_KEY` (carregada via `env.SERPAPI_KEY`)
- **Uso**: Integração com o SerpAPI (engine Google Maps) para buscar números de telefone de empresas a partir da razão social + município + UF. Retorna telefones normalizados (E.164) e é usada de forma conservadora por causa dos limites da conta gratuita.

### Serviços de E-mail a partir do PNCP
- **Base PNCP**: `https://pncp.gov.br/api/search` e `https://pncp.gov.br/api/consulta/v1`
- **Arquivo**: `src/services/email-search.service.ts`
- **Autenticação**: utiliza as mesmas APIs públicas do PNCP + stack de CNPJ acima (`lookupMultipleCnpjs`)
- **Uso**: Orquestra a busca de licitações com resultado no PNCP, extrai fornecedores e, em seguida, usa `lookupMultipleCnpjs` (BrasilAPI, CNPJá, CNPJ.ws, OpenCNPJ, ReceitaWS) para complementar e‑mails e telefones. O objetivo é gerar uma lista consolidada de fornecedores com e‑mail, valor homologado e resumo de licitações relacionadas.

---

## Comunicação e campanhas (WhatsApp)

### Evolution API – WhatsApp
- **URL base (configurável)**: `EVOLUTION_API_URL` (por exemplo, `https://evolution-api-production-1d69.up.railway.app`)
- **Arquivo**: `src/services/whatsapp.service.ts` (+ scripts em `scripts/*.ts`)
- **Autenticação**: header `apikey` com `EVOLUTION_API_KEY`
- **Variáveis de ambiente**: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`
- **Uso**: API de terceiros para envio de mensagens WhatsApp, gerenciamento de instância e verificação de números:
  - Criação e conexão de instância WhatsApp (QR code, estado da conexão).
  - Verificação em lote de quais números têm WhatsApp.
  - Envio de mensagens de campanha, com log em banco (`whatsappSendLog`) e atualização de métricas no registro do lead.

