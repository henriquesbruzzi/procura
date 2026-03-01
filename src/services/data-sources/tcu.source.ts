import { logger } from "../../utils/logger.js";
import { db } from "../../config/database.js";
import { leads } from "../../db/schema.js";
import { eq, and, isNull, sql } from "drizzle-orm";
import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface TcuCertidao {
  emissor: string;
  tipo: string;
  descricao: string;
  situacao: string; // "NADA_CONSTA" | "CONSTA"
  observacao: string | null;
}

interface TcuResponse {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  uf: string | null;
  certidoes: TcuCertidao[];
  seCnpjEncontradoNaBaseTcu: boolean;
}

const API_URL = "https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes";

/**
 * TCU Certidões APF — checks existing leads for legal issues.
 * Does NOT generate new leads; instead, it enriches existing ones
 * by cross-referencing TCU (Inidôneos), CNJ (Improbidade), CEIS, CNEP.
 *
 * Used as a data source adapter: fetches CNPJs from our own leads table
 * that haven't been checked yet, checks them against TCU API,
 * and returns only those with problems (situacao !== "NADA_CONSTA").
 */
export class TcuSource implements DataSource {
  readonly name = "tcu";
  readonly label = "TCU (Certidões APF)";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    const quantity = config.quantity || 50;

    // Get existing leads that haven't been checked by TCU yet
    // We'll use motivoLead !== 'verificado_tcu' as a simple flag
    const candidates = await db
      .select({ cnpj: leads.cnpj, razaoSocial: leads.razaoSocial, uf: leads.uf })
      .from(leads)
      .where(
        and(
          sql`length(${leads.cnpj}) = 14`,
          // Only check leads in the licitatório/administrativo area
          sql`${leads.areaJuridica} IN ('licitatorio', 'administrativo')`
        )
      )
      .limit(quantity * 3); // Over-fetch since most will be NADA_CONSTA

    logger.info(`TCU: verificando ${Math.min(candidates.length, quantity)} CNPJs`);

    const results: SourceResult[] = [];
    let checked = 0;

    for (const lead of candidates) {
      if (checked >= quantity) break;

      try {
        const res = await fetch(`${API_URL}/${lead.cnpj}`, {
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          logger.warn(`TCU: ${lead.cnpj} returned ${res.status}`);
          continue;
        }

        const data = (await res.json()) as TcuResponse;
        checked++;

        // Check if any certidão has issues (not NADA_CONSTA)
        const issues = data.certidoes.filter(
          (c) => c.situacao !== "NADA_CONSTA"
        );

        if (issues.length > 0) {
          const issueTypes = issues.map((i) => `${i.tipo}: ${i.situacao}`).join("; ");
          logger.info(`TCU: ${lead.cnpj} tem problemas: ${issueTypes}`);

          results.push({
            cnpj: lead.cnpj,
            razaoSocial: data.razaoSocial || lead.razaoSocial || undefined,
            uf: data.uf || lead.uf || undefined,
            fonte: "tcu",
          });
        }

        // Rate limit: be conservative, ~2 req/s
        await new Promise((r) => setTimeout(r, 500));
      } catch (err: any) {
        logger.error(`TCU: error checking ${lead.cnpj}: ${err.message}`);
      }
    }

    // Enrich results with phone/email data
    if (results.length > 0) {
      const cnpjs = results.map((r) => r.cnpj);
      logger.info(`TCU: enriquecendo ${cnpjs.length} CNPJs com problemas`);
      const enriched = await lookupMultipleCnpjs(cnpjs, false);
      for (const r of results) {
        const d = enriched.get(r.cnpj);
        if (d) {
          r.email = d.email ?? undefined;
          r.telefones = d.telefones ?? undefined;
          r.cnaePrincipal = d.cnaePrincipal ?? undefined;
          r.municipio = d.municipio ?? undefined;
          if (d.uf) r.uf = d.uf;
        }
      }
    }

    logger.info(`TCU: ${results.length} leads com problemas encontrados (de ${checked} verificados)`);
    return results;
  }
}
