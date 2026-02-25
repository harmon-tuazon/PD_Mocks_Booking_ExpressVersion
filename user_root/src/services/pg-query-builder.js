'use strict';

/**
 * pg-backed Supabase Query Builder Compatibility Layer
 *
 * Implements the Supabase chained query API (.from().select().eq()...) on top
 * of the node-postgres (pg) library. This allows all existing controllers that
 * use supabaseAdmin.from(...) to work without modification after the database
 * was migrated from Supabase to AWS RDS.
 *
 * Auth operations (supabaseAdmin.auth.*) still go to the real Supabase.
 */

const { Pool } = require('pg');

let _pool = null;

function getPool() {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      console.warn('WARNING: DATABASE_URL not configured. Database queries will fail.');
    }
    const schema = process.env.DATABASE_SCHEMA || 'hubspot_sync';
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    _pool.on('connect', function (client) {
      client.query('SET search_path TO "' + schema + '", public');
    });
    _pool.on('error', function (err) {
      console.error('PostgreSQL pool error:', err.message);
    });
  }
  return _pool;
}

// Sanitize a SQL identifier (table/column name) and wrap in double-quotes
function qid(name) {
  return '"' + String(name).replace(/[^a-zA-Z0-9_]/g, '') + '"';
}

// Parse Supabase column list: 'id, name, col3' -> '"id", "name", "col3"'
// Skips relation join syntax like 'groups_students(col)' (not supported)
function parseCols(cols) {
  if (!cols || cols === '*') return '*';
  const parts = cols.split(',').map(c => {
    const t = c.trim();
    if (t === '*') return '*';
    if (t.includes('(')) return null; // relation syntax - skip
    return qid(t);
  }).filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '*';
}

// Parse Supabase OR filter string: "col1.op1.val1,col2.op2.val2"
function parseOrFilter(filterStr) {
  const parts = [];
  const segments = filterStr.split(',');
  for (const seg of segments) {
    const d1 = seg.indexOf('.');
    const d2 = seg.indexOf('.', d1 + 1);
    if (d1 < 0 || d2 < 0) continue;
    parts.push({
      col: seg.substring(0, d1).trim(),
      op: seg.substring(d1 + 1, d2).trim(),
      val: seg.substring(d2 + 1)
    });
  }
  return parts;
}

class QueryBuilder {
  constructor(pool, table) {
    this._pool = pool;
    this._table = String(table).replace(/[^a-zA-Z0-9_]/g, '');
    this._op = null; // SELECT | INSERT | UPDATE | DELETE | UPSERT
    // SELECT fields
    this._selectCols = '*';
    this._countMode = null;
    // Mutation data
    this._insertData = null;
    this._updateData = null;
    this._upsertData = null;
    this._upsertConflict = null;
    // WHERE conditions stored as objects for deferred parameterization
    this._conditions = [];
    // ORDER / LIMIT / OFFSET
    this._orderClauses = [];
    this._limitVal = null;
    this._offsetVal = null;
    // Result shape
    this._single = false;
    this._maybeSingle = false;
    // RETURNING clause (after INSERT/UPDATE/DELETE)
    this._returning = false;
    this._returningCols = '*';
  }

  // ----- Operation methods -----

  select(cols, opts) {
    if (!this._op || this._op === 'SELECT') {
      this._op = 'SELECT';
      this._selectCols = parseCols(cols);
      if (opts && opts.count === 'exact') this._countMode = 'exact';
    } else {
      // Called after insert/update/delete → RETURNING
      this._returning = true;
      this._returningCols = parseCols(cols);
    }
    return this;
  }

  insert(data) {
    this._op = 'INSERT';
    this._insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data) {
    this._op = 'UPDATE';
    this._updateData = data;
    return this;
  }

  delete() {
    this._op = 'DELETE';
    return this;
  }

  upsert(data, opts) {
    this._op = 'UPSERT';
    this._upsertData = Array.isArray(data) ? data : [data];
    this._upsertConflict = opts && opts.onConflict ? opts.onConflict : null;
    return this;
  }

  // ----- Filter methods -----

  eq(col, val) { this._conditions.push({ type: 'eq', col, val }); return this; }
  neq(col, val) { this._conditions.push({ type: 'neq', col, val }); return this; }
  gt(col, val) { this._conditions.push({ type: 'gt', col, val }); return this; }
  gte(col, val) { this._conditions.push({ type: 'gte', col, val }); return this; }
  lt(col, val) { this._conditions.push({ type: 'lt', col, val }); return this; }
  lte(col, val) { this._conditions.push({ type: 'lte', col, val }); return this; }
  ilike(col, val) { this._conditions.push({ type: 'ilike', col, val }); return this; }
  like(col, val) { this._conditions.push({ type: 'like', col, val }); return this; }
  in(col, val) { this._conditions.push({ type: 'in', col, val }); return this; }
  is(col, val) { this._conditions.push({ type: 'is', col, val }); return this; }
  not(col, op, val) { this._conditions.push({ type: 'not', col, op, val }); return this; }
  contains(col, val) { this._conditions.push({ type: 'contains', col, val }); return this; }

  or(filterStr) {
    const parts = parseOrFilter(filterStr);
    if (parts.length > 0) this._conditions.push({ type: 'or', parts });
    return this;
  }

  // ----- Ordering / pagination -----

  order(col, opts) {
    const dir = opts && opts.ascending === false ? 'DESC' : 'ASC';
    const nullsFirst = opts && opts.nullsFirst ? true : false;
    this._orderClauses.push({ col, dir, nullsFirst });
    return this;
  }

  range(from, to) {
    this._offsetVal = from;
    this._limitVal = to - from + 1;
    return this;
  }

  limit(n) {
    this._limitVal = n;
    return this;
  }

  // ----- Result shape -----

  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  // ----- WHERE clause builder -----
  // `startIdx` is the $N index for the first param in this WHERE clause.
  _buildWhere(startIdx) {
    const params = [];
    let idx = startIdx;

    function addParam(val) {
      params.push(val);
      return '$' + idx++;
    }

    function orPartToSql(p) {
      const col = qid(p.col);
      const op = p.op;
      const val = p.val;
      switch (op) {
        case 'eq':  return val === 'null' ? col + ' IS NULL' : col + ' = ' + addParam(val);
        case 'neq': return col + ' != ' + addParam(val);
        case 'gt':  return col + ' > ' + addParam(val);
        case 'gte': return col + ' >= ' + addParam(val);
        case 'lt':  return col + ' < ' + addParam(val);
        case 'lte': return col + ' <= ' + addParam(val);
        case 'ilike': return col + ' ILIKE ' + addParam(val);
        case 'like':  return col + ' LIKE ' + addParam(val);
        case 'is':
          if (val === 'null' || val === null) return col + ' IS NULL';
          return col + ' IS ' + addParam(val);
        case 'in': {
          const arr = val.replace(/^\(|\)$/g, '').split(',').map(s => s.trim());
          return col + ' = ANY(' + addParam(arr) + ')';
        }
        default: return 'TRUE';
      }
    }

    function condToSql(cond) {
      const col = qid(cond.col);
      switch (cond.type) {
        case 'eq':
          if (cond.val === null) return col + ' IS NULL';
          return col + ' = ' + addParam(cond.val);
        case 'neq':
          if (cond.val === null) return col + ' IS NOT NULL';
          return col + ' != ' + addParam(cond.val);
        case 'gt':  return col + ' > '  + addParam(cond.val);
        case 'gte': return col + ' >= ' + addParam(cond.val);
        case 'lt':  return col + ' < '  + addParam(cond.val);
        case 'lte': return col + ' <= ' + addParam(cond.val);
        case 'ilike': return col + ' ILIKE ' + addParam(cond.val);
        case 'like':  return col + ' LIKE '  + addParam(cond.val);
        case 'in':
          if (!cond.val || cond.val.length === 0) return 'FALSE';
          return col + ' = ANY(' + addParam(cond.val) + ')';
        case 'is':
          if (cond.val === null) return col + ' IS NULL';
          if (cond.val === true)  return col + ' IS TRUE';
          if (cond.val === false) return col + ' IS FALSE';
          return col + ' IS NOT DISTINCT FROM ' + addParam(cond.val);
        case 'not':
          if (cond.op === 'is' && cond.val === null) return col + ' IS NOT NULL';
          if (cond.op === 'in') {
            if (!cond.val || cond.val.length === 0) return 'TRUE';
            return col + ' != ALL(' + addParam(cond.val) + ')';
          }
          if (cond.op === 'eq') {
            if (cond.val === null) return col + ' IS NOT NULL';
            return col + ' != ' + addParam(cond.val);
          }
          return 'NOT (' + col + ' ' + cond.op + ' ' + addParam(cond.val) + ')';
        case 'contains':
          return col + ' @> ' + addParam(JSON.stringify(cond.val));
        case 'or': {
          const parts = cond.parts.map(orPartToSql);
          return '(' + parts.join(' OR ') + ')';
        }
        default: return 'TRUE';
      }
    }

    const clauses = this._conditions.map(condToSql);
    const sql = clauses.length > 0 ? ' WHERE ' + clauses.join(' AND ') : '';
    return { sql, params };
  }

  // ----- SQL execution -----

  async _execute() {
    const pool = this._pool;
    const qtable = qid(this._table);

    try {
      let sql, params, result;

      // ---------- INSERT ----------
      if (this._op === 'INSERT') {
        const rows = this._insertData;
        const cols = Object.keys(rows[0]);
        const quotedCols = cols.map(qid).join(', ');
        const allParams = [];
        const valueSets = rows.map(row => {
          const phs = cols.map(c => { allParams.push(row[c]); return '$' + allParams.length; });
          return '(' + phs.join(', ') + ')';
        });
        sql = 'INSERT INTO ' + qtable + ' (' + quotedCols + ') VALUES ' + valueSets.join(', ');
        if (this._returning) sql += ' RETURNING ' + this._returningCols;
        params = allParams;

      // ---------- UPDATE ----------
      } else if (this._op === 'UPDATE') {
        const data = this._updateData;
        const cols = Object.keys(data);
        const setParams = [];
        const setClauses = cols.map(c => {
          setParams.push(data[c]);
          return qid(c) + ' = $' + setParams.length;
        });
        const { sql: whereSql, params: whereParams } = this._buildWhere(setParams.length + 1);
        sql = 'UPDATE ' + qtable + ' SET ' + setClauses.join(', ') + whereSql;
        if (this._returning) sql += ' RETURNING ' + this._returningCols;
        params = [...setParams, ...whereParams];

      // ---------- DELETE ----------
      } else if (this._op === 'DELETE') {
        const { sql: whereSql, params: whereParams } = this._buildWhere(1);
        sql = 'DELETE FROM ' + qtable + whereSql;
        if (this._returning) sql += ' RETURNING ' + this._returningCols;
        params = whereParams;

      // ---------- UPSERT ----------
      } else if (this._op === 'UPSERT') {
        const rows = this._upsertData;
        const cols = Object.keys(rows[0]);
        const quotedCols = cols.map(qid).join(', ');
        const allParams = [];
        const valueSets = rows.map(row => {
          const phs = cols.map(c => { allParams.push(row[c]); return '$' + allParams.length; });
          return '(' + phs.join(', ') + ')';
        });
        sql = 'INSERT INTO ' + qtable + ' (' + quotedCols + ') VALUES ' + valueSets.join(', ');
        if (this._upsertConflict) {
          const conflictCols = this._upsertConflict.split(',').map(c => qid(c.trim())).join(', ');
          const conflictSet = new Set(this._upsertConflict.split(',').map(c => c.trim()));
          const updateCols = cols.filter(c => !conflictSet.has(c));
          if (updateCols.length > 0) {
            const updateSet = updateCols.map(c => qid(c) + ' = EXCLUDED.' + qid(c)).join(', ');
            sql += ' ON CONFLICT (' + conflictCols + ') DO UPDATE SET ' + updateSet;
          } else {
            sql += ' ON CONFLICT (' + conflictCols + ') DO NOTHING';
          }
        } else {
          sql += ' ON CONFLICT DO NOTHING';
        }
        if (this._returning) sql += ' RETURNING ' + this._returningCols;
        params = allParams;

      // ---------- SELECT (default) ----------
      } else {
        let cols = this._selectCols;
        if (this._countMode === 'exact') {
          cols = (cols === '*' ? '*' : cols) + ', COUNT(*) OVER() AS "__total_count__"';
        }
        const { sql: whereSql, params: whereParams } = this._buildWhere(1);
        sql = 'SELECT ' + cols + ' FROM ' + qtable + whereSql;
        if (this._orderClauses.length > 0) {
          const orderParts = this._orderClauses.map(o =>
            qid(o.col) + ' ' + o.dir + (o.nullsFirst ? ' NULLS FIRST' : '')
          );
          sql += ' ORDER BY ' + orderParts.join(', ');
        }
        if (this._limitVal !== null)  sql += ' LIMIT '  + parseInt(this._limitVal);
        if (this._offsetVal !== null) sql += ' OFFSET ' + parseInt(this._offsetVal);
        params = whereParams;
      }

      result = await pool.query(sql, params);
      const rows = result.rows;

      // Extract window-function count for SELECT with count mode
      let count = null;
      if (this._countMode === 'exact') {
        count = rows.length > 0 ? parseInt(rows[0].__total_count__ || 0) : 0;
        rows.forEach(r => { delete r.__total_count__; });
      }

      // Handle .single() — error if no row
      if (this._single) {
        if (rows.length === 0) {
          return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, count: null };
        }
        return { data: rows[0], error: null, count: null };
      }

      // Handle .maybeSingle() — null if no row, no error
      if (this._maybeSingle) {
        return { data: rows.length > 0 ? rows[0] : null, error: null, count: null };
      }

      // Mutations without RETURNING
      if ((this._op === 'INSERT' || this._op === 'UPDATE' || this._op === 'DELETE' || this._op === 'UPSERT') && !this._returning) {
        return { data: null, error: null, count: result.rowCount };
      }

      return { data: rows, error: null, count };

    } catch (err) {
      console.error('[pg-query-builder] SQL error on table "' + this._table + '":', err.message);
      return {
        data: null,
        error: { message: err.message, code: err.code || 'UNKNOWN', details: err.detail || null },
        count: null
      };
    }
  }

  // Make QueryBuilder thenable (awaitable)
  then(resolve, reject) { return this._execute().then(resolve, reject); }
  catch(reject)         { return this._execute().catch(reject); }
  finally(fn)           { return this._execute().finally(fn); }
}

// ----- RPC builder -----

class RpcBuilder {
  constructor(pool, fnName, params) {
    this._pool = pool;
    this._fnName = String(fnName).replace(/[^a-zA-Z0-9_]/g, '');
    this._params = params || {};
    this._single = false;
  }

  single() { this._single = true; return this; }

  async _execute() {
    try {
      const keys = Object.keys(this._params);
      const vals = keys.map(k => this._params[k]);
      const fnId = '"' + this._fnName + '"';

      let sql;
      if (keys.length === 0) {
        sql = 'SELECT * FROM ' + fnId + '()';
      } else {
        const namedParams = keys.map((k, i) =>
          '"' + k.replace(/[^a-zA-Z0-9_]/g, '') + '" => $' + (i + 1)
        );
        sql = 'SELECT * FROM ' + fnId + '(' + namedParams.join(', ') + ')';
      }

      const result = await this._pool.query(sql, vals);
      const rows = result.rows;

      // If function returns a single scalar value (e.g. integer count), unwrap it
      if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
        const key = Object.keys(rows[0])[0];
        const val = rows[0][key];
        if (typeof val === 'number' || typeof val === 'bigint' || key === this._fnName) {
          return { data: typeof val === 'bigint' ? Number(val) : val, error: null };
        }
      }

      if (this._single) {
        return { data: rows.length > 0 ? rows[0] : null, error: null };
      }

      return { data: rows, error: null };
    } catch (err) {
      console.error('[pg-query-builder] RPC error on "' + this._fnName + '":', err.message);
      return { data: null, error: { message: err.message, code: err.code || 'UNKNOWN' } };
    }
  }

  then(resolve, reject) { return this._execute().then(resolve, reject); }
  catch(reject)         { return this._execute().catch(reject); }
  finally(fn)           { return this._execute().finally(fn); }
}

// ----- Factory -----

function createPgClient(pool) {
  return {
    from(table) { return new QueryBuilder(pool, table); },
    rpc(fnName, params) { return new RpcBuilder(pool, fnName, params); }
  };
}

module.exports = { createPgClient, getPool };
