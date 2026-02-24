/**
 * Supabase Database Export Script (Node.js)
 * Exports schema + data for: public, hubspot_sync, auth
 *
 * Usage: node PRDs/aws_migration/dump_db.js
 *
 * Prerequisites: npm install pg
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ━━━ CONNECTION STRING ━━━
const DB_URL = process.env.SUPABASE_DB_URL || 'postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres';
const OUT_DIR = path.join(__dirname);

const SCHEMAS = ['public', 'hubspot_sync', 'auth'];

async function run() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('=== Supabase Database Export ===\n');

  let step = 0;
  const total = SCHEMAS.length * 2;

  for (const schema of SCHEMAS) {
    // ─── Schema structure ───
    step++;
    console.log(`[${step}/${total}] Dumping ${schema} schema structure...`);
    try {
      const schemaSql = await dumpSchema(client, schema);
      const schemaFile = path.join(OUT_DIR, `${schema}_schema.sql`);
      fs.writeFileSync(schemaFile, schemaSql, 'utf8');
      console.log(`  ✓ ${schema}_schema.sql (${(Buffer.byteLength(schemaSql) / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.log(`  ✗ FAILED: ${err.message}`);
    }

    // ─── Data ───
    step++;
    console.log(`[${step}/${total}] Dumping ${schema} data...`);
    try {
      const dataSql = await dumpData(client, schema);
      const dataFile = path.join(OUT_DIR, `${schema}_data.sql`);
      fs.writeFileSync(dataFile, dataSql, 'utf8');
      console.log(`  ✓ ${schema}_data.sql (${(Buffer.byteLength(dataSql) / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.log(`  ✗ FAILED: ${err.message}`);
    }
  }

  await client.end();
  console.log('\n=== Done ===');
}

// ─── Dump schema structure (tables, columns, constraints, indexes, enums, functions, triggers, RLS) ───
async function dumpSchema(client, schemaName) {
  const parts = [];
  parts.push(`-- Schema structure dump: ${schemaName}`);
  parts.push(`-- Generated: ${new Date().toISOString()}\n`);
  parts.push(`CREATE SCHEMA IF NOT EXISTS ${esc(schemaName)};\n`);

  // Enums
  const enums = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = $1
    ORDER BY t.typname, e.enumsortorder
  `, [schemaName]);

  const enumMap = {};
  for (const row of enums.rows) {
    if (!enumMap[row.typname]) enumMap[row.typname] = [];
    enumMap[row.typname].push(row.enumlabel);
  }
  for (const [name, labels] of Object.entries(enumMap)) {
    parts.push(`CREATE TYPE ${esc(schemaName)}.${esc(name)} AS ENUM (${labels.map(l => `'${l}'`).join(', ')});\n`);
  }

  // Tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schemaName]);

  for (const { table_name } of tables.rows) {
    parts.push(await dumpTableDDL(client, schemaName, table_name));
  }

  // Indexes
  const indexes = await client.query(`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = $1
    ORDER BY tablename, indexname
  `, [schemaName]);
  if (indexes.rows.length > 0) {
    parts.push('-- Indexes');
    for (const row of indexes.rows) {
      parts.push(row.indexdef + ';');
    }
    parts.push('');
  }

  // Functions
  const funcs = await client.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) AS funcdef
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = $1
    AND p.prokind IN ('f', 'p')
    ORDER BY p.proname
  `, [schemaName]);
  if (funcs.rows.length > 0) {
    parts.push('-- Functions and Procedures');
    for (const row of funcs.rows) {
      parts.push(row.funcdef + ';\n');
    }
  }

  // Triggers
  const triggers = await client.query(`
    SELECT
      tg.tgname AS trigger_name,
      cls.relname AS table_name,
      pg_get_triggerdef(tg.oid) AS triggerdef
    FROM pg_trigger tg
    JOIN pg_class cls ON tg.tgrelid = cls.oid
    JOIN pg_namespace n ON cls.relnamespace = n.oid
    WHERE n.nspname = $1 AND NOT tg.tgisinternal
    ORDER BY cls.relname, tg.tgname
  `, [schemaName]);
  if (triggers.rows.length > 0) {
    parts.push('-- Triggers');
    for (const row of triggers.rows) {
      parts.push(row.triggerdef + ';\n');
    }
  }

  // RLS policies
  const policies = await client.query(`
    SELECT
      pol.polname AS policy_name,
      cls.relname AS table_name,
      CASE pol.polcmd
        WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
        ELSE 'ALL'
      END AS command,
      CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS type,
      pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
      pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr,
      (SELECT string_agg(rolname, ',') FROM pg_roles WHERE oid = ANY(pol.polroles)) AS roles
    FROM pg_policy pol
    JOIN pg_class cls ON pol.polrelid = cls.oid
    JOIN pg_namespace n ON cls.relnamespace = n.oid
    WHERE n.nspname = $1
    ORDER BY cls.relname, pol.polname
  `, [schemaName]);

  // RLS enabled tables
  const rlsTables = await client.query(`
    SELECT relname FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = $1 AND c.relrowsecurity = true
    ORDER BY relname
  `, [schemaName]);

  if (rlsTables.rows.length > 0 || policies.rows.length > 0) {
    parts.push('-- Row Level Security');
    for (const { relname } of rlsTables.rows) {
      parts.push(`ALTER TABLE ${esc(schemaName)}.${esc(relname)} ENABLE ROW LEVEL SECURITY;`);
    }
    parts.push('');
    for (const pol of policies.rows) {
      const roles = pol.roles ? `TO ${pol.roles.split(',').join(', ')}` : '';
      let stmt = `CREATE POLICY ${esc(pol.policy_name)} ON ${esc(schemaName)}.${esc(pol.table_name)}`;
      stmt += ` AS ${pol.type} FOR ${pol.command} ${roles}`;
      if (pol.using_expr) stmt += ` USING (${pol.using_expr})`;
      if (pol.check_expr) stmt += ` WITH CHECK (${pol.check_expr})`;
      parts.push(stmt + ';\n');
    }
  }

  return parts.join('\n');
}

// ─── Dump a single table's CREATE TABLE statement ───
async function dumpTableDDL(client, schema, table) {
  const cols = await client.query(`
    SELECT
      column_name, data_type, udt_name, character_maximum_length,
      column_default, is_nullable, is_identity,
      identity_generation
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [schema, table]);

  const lines = [];
  for (const col of cols.rows) {
    let type = col.data_type === 'USER-DEFINED' ? `${esc(schema)}.${esc(col.udt_name)}` :
               col.data_type === 'ARRAY' ? `${col.udt_name.replace(/^_/, '')}[]` :
               col.character_maximum_length ? `${col.data_type}(${col.character_maximum_length})` :
               col.data_type;
    let line = `  ${esc(col.column_name)} ${type}`;
    if (col.column_default) line += ` DEFAULT ${col.column_default}`;
    if (col.is_nullable === 'NO') line += ' NOT NULL';
    if (col.is_identity === 'YES') line += ` GENERATED ${col.identity_generation} AS IDENTITY`;
    lines.push(line);
  }

  // Primary key
  const pk = await client.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
  `, [schema, table]);
  if (pk.rows.length > 0) {
    lines.push(`  PRIMARY KEY (${pk.rows.map(r => esc(r.column_name)).join(', ')})`);
  }

  // Foreign keys
  const fks = await client.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS ref_schema,
      ccu.table_name AS ref_table,
      ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
  `, [schema, table]);
  for (const fk of fks.rows) {
    lines.push(`  CONSTRAINT ${esc(fk.constraint_name)} FOREIGN KEY (${esc(fk.column_name)}) REFERENCES ${esc(fk.ref_schema)}.${esc(fk.ref_table)}(${esc(fk.ref_column)})`);
  }

  // Unique constraints
  const uqs = await client.query(`
    SELECT tc.constraint_name, string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'UNIQUE'
    GROUP BY tc.constraint_name
  `, [schema, table]);
  for (const uq of uqs.rows) {
    const cols = uq.columns.split(',').map(c => esc(c.trim())).join(', ');
    lines.push(`  CONSTRAINT ${esc(uq.constraint_name)} UNIQUE (${cols})`);
  }

  return `CREATE TABLE ${esc(schema)}.${esc(table)} (\n${lines.join(',\n')}\n);\n`;
}

// ─── Dump data as INSERT statements ───
async function dumpData(client, schemaName) {
  const parts = [];
  parts.push(`-- Data dump: ${schemaName}`);
  parts.push(`-- Generated: ${new Date().toISOString()}\n`);

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schemaName]);

  for (const { table_name } of tables.rows) {
    const count = await client.query(`SELECT count(*) FROM ${esc(schemaName)}.${esc(table_name)}`);
    const rowCount = parseInt(count.rows[0].count);
    if (rowCount === 0) continue;

    parts.push(`-- Table: ${schemaName}.${table_name} (${rowCount} rows)`);

    // Fetch in batches of 1000
    const batchSize = 1000;
    for (let offset = 0; offset < rowCount; offset += batchSize) {
      const rows = await client.query(
        `SELECT * FROM ${esc(schemaName)}.${esc(table_name)} LIMIT ${batchSize} OFFSET ${offset}`
      );
      if (rows.rows.length === 0) break;

      const columns = rows.fields.map(f => esc(f.name)).join(', ');

      for (const row of rows.rows) {
        const values = rows.fields.map(f => {
          const val = row[f.name];
          if (val === null) return 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'number') return val.toString();
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${escVal(JSON.stringify(val))}'::jsonb`;
          return `'${escVal(String(val))}'`;
        }).join(', ');

        parts.push(`INSERT INTO ${esc(schemaName)}.${esc(table_name)} (${columns}) VALUES (${values});`);
      }
    }
    parts.push('');
  }

  return parts.join('\n');
}

function esc(name) { return `"${name}"`; }
function escVal(str) { return str.replace(/'/g, "''"); }

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
