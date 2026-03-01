import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // Batch updates by fonte (much faster than one-by-one)

    // PNCP
    let r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'vencedor_licitacao', fonte_descricao = 'Empresa vencedora de licitação (PNCP)' WHERE area_juridica IS NULL AND fonte = 'pncp' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`pncp: ${r.rowCount} atualizados`);

    // PNCP contratos
    r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'contrato_ativo', fonte_descricao = 'Empresa com contrato público ativo (PNCP Contratos)' WHERE area_juridica IS NULL AND fonte = 'pncp_contratos' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`pncp_contratos: ${r.rowCount} atualizados`);

    // SICAF
    r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'fornecedor_cadastrado', fonte_descricao = 'Fornecedor cadastrado no SICAF' WHERE area_juridica IS NULL AND fonte = 'sicaf' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`sicaf: ${r.rowCount} atualizados`);

    // TCE-SP
    r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'vencedor_licitacao', fonte_descricao = 'Despesa pública registrada (TCE-SP)' WHERE area_juridica IS NULL AND fonte = 'tce_sp' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`tce_sp: ${r.rowCount} atualizados`);

    // TCE-RJ
    r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'vencedor_licitacao', fonte_descricao = 'Contrato público registrado (TCE-RJ)' WHERE area_juridica IS NULL AND fonte = 'tce_rj' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`tce_rj: ${r.rowCount} atualizados`);

    // CEIS
    r = await client.query(`UPDATE leads SET area_juridica = 'administrativo', motivo_lead = 'empresa_sancionada', fonte_descricao = 'Empresa inidônea ou suspensa (CEIS)' WHERE area_juridica IS NULL AND fonte = 'ceis' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`ceis: ${r.rowCount} atualizados`);

    // CNEP
    r = await client.query(`UPDATE leads SET area_juridica = 'administrativo', motivo_lead = 'empresa_punida', fonte_descricao = 'Empresa punida (CNEP)' WHERE area_juridica IS NULL AND fonte = 'cnep' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`cnep: ${r.rowCount} atualizados`);

    // Transparência
    r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'convenio_federal', fonte_descricao = 'Convênio federal (Portal da Transparência)' WHERE area_juridica IS NULL AND fonte = 'transparencia' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`transparencia: ${r.rowCount} atualizados`);

    // Diário oficial PF → PAD
    r = await client.query(`UPDATE leads SET area_juridica = 'administrativo', motivo_lead = 'pad_servidor', fonte_descricao = 'Servidor em PAD (Diário Oficial)' WHERE area_juridica IS NULL AND fonte = 'diario_oficial' AND tipo_pessoa = 'PF' AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`diario_oficial PF: ${r.rowCount} atualizados`);

    // Diário oficial PJ → licitação
    r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'vencedor_licitacao', fonte_descricao = 'Empresa mencionada em diário oficial' WHERE area_juridica IS NULL AND fonte = 'diario_oficial' AND (tipo_pessoa != 'PF' OR tipo_pessoa IS NULL) AND (categoria IS NULL OR categoria != 'contabilidade')`);
    console.log(`diario_oficial PJ: ${r.rowCount} atualizados`);

    // Contabilidade (qualquer fonte)
    r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'parceria_contabilidade', fonte_descricao = 'Escritório de contabilidade (parceria)' WHERE area_juridica IS NULL AND categoria = 'contabilidade'`);
    console.log(`contabilidade: ${r.rowCount} atualizados`);

    // Fallback: remaining leads without mapping
    r = await client.query(`UPDATE leads SET area_juridica = 'licitatorio', motivo_lead = 'outro', fonte_descricao = 'Lead de fonte: ' || COALESCE(fonte, 'desconhecida') WHERE area_juridica IS NULL`);
    console.log(`fallback: ${r.rowCount} atualizados`);

    // Final stats
    const { rows: [stats] } = await client.query(`
      SELECT
        count(*) as total,
        count(*) FILTER (WHERE area_juridica IS NOT NULL) as backfilled,
        count(*) FILTER (WHERE area_juridica IS NULL) as pending
      FROM leads
    `);
    console.log("\nFinal:", stats);

    const { rows: dist } = await client.query(`
      SELECT area_juridica, motivo_lead, count(*) as total
      FROM leads WHERE area_juridica IS NOT NULL
      GROUP BY area_juridica, motivo_lead ORDER BY total DESC
    `);
    console.log("\nDistribuição:");
    for (const d of dist) console.log(`  ${d.area_juridica} / ${d.motivo_lead}: ${d.total}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
