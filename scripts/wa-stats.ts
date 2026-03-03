import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const stats = await db.execute(sql`
SELECT
  COUNT(*)::int as total_leads,
  COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')::int as com_telefone,
  COUNT(*) FILTER (WHERE tem_celular = true)::int as com_celular,
  COUNT(*) FILTER (WHERE tem_whatsapp = true)::int as com_whatsapp,
  COUNT(*) FILTER (WHERE tem_whatsapp = true AND whatsapp_sent_count = 0)::int as wa_nunca_enviado,
  COUNT(*) FILTER (WHERE tem_whatsapp = true AND whatsapp_sent_count > 0)::int as wa_ja_enviado,
  COUNT(*) FILTER (WHERE tem_whatsapp = true AND whatsapp_sent_count = 1)::int as wa_enviado_1x,
  COUNT(*) FILTER (WHERE tem_whatsapp = true AND whatsapp_sent_count >= 2)::int as wa_enviado_2x
FROM leads
`);
console.log("=== LEADS WhatsApp STATS ===");
console.log(JSON.stringify(stats.rows[0], null, 2));

const byArea = await db.execute(sql`
SELECT
  COALESCE(area_juridica, 'sem_area') as area,
  COALESCE(motivo_lead, 'sem_motivo') as motivo,
  COUNT(*)::int as wa_disponivel,
  COUNT(*) FILTER (WHERE whatsapp_sent_count = 0)::int as nunca_enviado
FROM leads
WHERE tem_whatsapp = true
GROUP BY area_juridica, motivo_lead
ORDER BY wa_disponivel DESC
`);
console.log("\n=== POR AREA/MOTIVO (com WhatsApp) ===");
for (const r of byArea.rows) console.log(JSON.stringify(r));

const byFonte = await db.execute(sql`
SELECT
  COALESCE(fonte, 'sem_fonte') as fonte,
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')::int as com_tel,
  COUNT(*) FILTER (WHERE tem_whatsapp = true)::int as wa_ok,
  COUNT(*) FILTER (WHERE tem_whatsapp = true AND whatsapp_sent_count = 0)::int as wa_novo
FROM leads
GROUP BY fonte
ORDER BY wa_ok DESC
`);
console.log("\n=== POR FONTE ===");
for (const r of byFonte.rows) console.log(JSON.stringify(r));

process.exit(0);
