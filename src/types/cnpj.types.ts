// BrasilAPI CNPJ response
export interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  email: string | null;
  ddd_telefone_1: string;
  ddd_telefone_2: string;
  logradouro: string;
  municipio: string;
  uf: string;
  cep: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  descricao_situacao_cadastral: string;
  porte: string;
}

// CNPJá open API response (open.cnpja.com)
export interface CnpjaResponse {
  taxId: string;
  company: {
    name: string;
    size?: { text: string };
  };
  alias: string | null;
  status: { text: string };
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  mainActivity: { text: string };
  phones: Array<{ area: string; number: string }>;
  emails: Array<{ address: string; domain: string }>;
}

// CNPJ.ws API response (publica.cnpj.ws)
export interface CnpjWsResponse {
  cnpj_raiz: string;
  razao_social: string;
  estabelecimento: {
    cnpj: string;
    nome_fantasia: string;
    email: string | null;
    logradouro: string;
    municipio: string;
    bairro: string;
    cep: string;
    ddd1: string;
    telefone1: string;
    ddd2: string | null;
    telefone2: string | null;
    situacao_cadastral: string;
    atividade_principal: {
      descricao: string;
    };
    estado: {
      sigla: string;
    };
    cidade: {
      nome: string;
    };
  };
}

// ReceitaWS API response
export interface ReceitaWsResponse {
  cnpj: string;
  nome: string;
  fantasia: string;
  email: string;
  telefone: string;
  logradouro: string;
  municipio: string;
  uf: string;
  cep: string;
  atividade_principal: Array<{ code: string; text: string }>;
  situacao: string;
  porte: string;
  status: string;
}

// OpenCNPJ API response (api.opencnpj.org)
export interface OpenCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  cnae_principal: string;
  logradouro: string;
  uf: string;
  municipio: string;
  cep: string;
  email: string | null;
  telefones: Array<{ ddd: string; numero: string; is_fax: boolean }>;
  capital_social: string;
  porte_empresa: string;
}

// Normalized CNPJ data
export interface CnpjData {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  email: string | null;
  telefones: string | null;
  logradouro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  cnaePrincipal: string | null;
  situacaoCadastral: string | null;
  emailSource: "brasilapi" | "cnpja" | "receitaws" | "cnpjws" | "opencnpj" | "not_found" | "lookup_failed";
  emailCategory: "empresa" | "contabilidade";
}
