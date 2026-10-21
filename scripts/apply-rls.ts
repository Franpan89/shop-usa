/** Aplica prisma/rls.sql y muestra el estado de RLS por tabla.  npx tsx scripts/apply-rls.ts */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(readFileSync('prisma/rls.sql', 'utf8'));
  const { rows } = await pool.query(
    `select c.relname as tabla, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by 1`,
  );
  console.table(rows);
  const sinRls = rows.filter((r) => !r.rls);
  if (sinRls.length) throw new Error(`Tablas sin RLS: ${sinRls.map((r) => r.tabla).join(', ')}`);
  console.log('RLS activo en todas las tablas.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
