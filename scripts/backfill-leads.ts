import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MAPPING: Record<string, { area: string; motivo: string; descricao: string }> = {
  pncp: { area: "licitatorio", motivo: "vencedor_licitacao", descricao: "Empresa vencedora de licitação (PNCP)" },
  pncp_contratos: { area: "licitatorio", motivo: "contrato_ativo", descricao: "Empresa com contrato público ativo (PNCP Contratos)" },
  sicaf: { area: "licitatorio", motivo: "fornecedor_cadastrado", descricao: "Fornecedor cadastrado no SICAF" },
  tce_sp: { area: "licitatorio", motivo: "vencedor_licitacao", descricao: "Despesa pública registrada (TCE-SP)" },
  tce_rj: { area: "licitatorio", motivo: "vencedor_licitacao", descricao: "Contrato público registrado (TCE-RJ)" },
  ceis: { area: "administrativo", motivo: "empresa_sancionada", descricao: "Empresa inidônea ou suspensa (CEIS)" },
  cnep: { area: "administrativo", motivo: "empresa_punida", descricao: "Empresa punida (CNEP)" },
  transparencia: { area: "licitatorio", motivo: "convenio_federal", descricao: "Convênio federal (Portal da Transparência)" },
};

// Diário oficial tem tratamento especial: PF = PAD, PJ = licitação
const DIARIO_PF = { area: "administrativo", motivo: "pad_servidor", descricao: "Servidor em PAD (Diário Oficial)" };
const DIARIO_PJ = { area: "licitatorio", motivo: "vencedor_licitacao", descricao: "Empresa mencionada em diário oficial" };

// Contabilidade override
const CONTABILIDADE = { area: "licitatorio", motivo: "parceria_contabilidade", descricao: "Escritório de contabilidade (parceria)" };

async function main() {
  const client = await pool.connect();
  try {
    // Get all leads
    const { rows: leads } = await client.query("SELECT id, fonte, tipo_pessoa, categoria FROM leads WHERE area_juridica IS NULL");
    console.log(`Leads para backfill: ${leads.length}`);

    let updated = 0;
    for (const lead of leads) {
      let mapping;

      // Contabilidade sempre tem mapeamento especial
      if (lead.categoria === "contabilidade") {
        mapping = CONTABILIDADE;
      } else if (lead.fonte === "diario_oficial") {
        mapping = lead.tipo_pessoa === "PF" ? DIARIO_PF : DIARIO_PJ;
      } else {
        mapping = MAPPING[lead.fonte] || { area: "licitatorio", motivo: "outro", descricao: `Lead de fonte: ${lead.fonte || "desconhecida"}` };
      }

      await client.query(
        "UPDATE leads SET area_juridica = $1, motivo_lead = $2, fonte_descricao = $3 WHERE id = $4",
        [mapping.area, mapping.motivo, mapping.descricao, lead.id]
      );
      updated++;
    }

    console.log(`Backfill concluído: ${updated} leads atualizados`);

    // Stats
    const { rows: stats } = await client.query(`
      SELECT area_juridica, motivo_lead, count(*) as total
      FROM leads
      WHERE area_juridica IS NOT NULL
      GROUP BY area_juridica, motivo_lead
      ORDER BY total DESC
    `);
    console.log("\n=== Distribuição ===");
    for (const s of stats) {
      console.log(`  ${s.area_juridica} / ${s.motivo_lead}: ${s.total}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
