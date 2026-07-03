const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const rawConnectionString = process.env.DATABASE_URL || 'postgresql://postgres.kewtadtuizlncqpphzcf:P*KD,QaC_bE8@SH@aws-1-us-west-2.pooler.supabase.com:5432/postgres';

function normalizeConnectionString(connectionString) {
  const lastAt = connectionString.lastIndexOf('@');
  if (lastAt <= 0) return connectionString;

  const prefix = connectionString.slice(0, lastAt);
  const suffix = connectionString.slice(lastAt + 1);

  const schemeSeparator = '://';
  const schemeIndex = prefix.indexOf(schemeSeparator);
  if (schemeIndex < 0) return connectionString;

  const scheme = prefix.slice(0, schemeIndex + schemeSeparator.length);
  const authPart = prefix.slice(schemeIndex + schemeSeparator.length);
  const encodedAuth = authPart.replace(/@/g, '%40');
  return `${scheme}${encodedAuth}@${suffix}`;
}

const connectionString = normalizeConnectionString(rawConnectionString);
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/livros', async (req, res) => {
  try {
    const query = `
      SELECT
        ctid::text AS id,
        titulo,
        autor,
        descricao,
        paginas,
        paginas_lidas,
        capa,
        created_at
      FROM acervo_literario
      ORDER BY titulo
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar livros:', error);
    res.status(500).json({ error: 'Erro ao buscar livros' });
  }
});

app.post('/api/livros', async (req, res) => {
  try {
    const { titulo, autor, descricao = '', paginas = 0, paginas_lidas = 0, capa = '' } = req.body;
    const query = `
      INSERT INTO acervo_literario (titulo, autor, descricao, paginas, paginas_lidas, capa)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ctid::text AS id, titulo, autor, descricao, paginas, paginas_lidas, capa, created_at
    `;
    const result = await pool.query(query, [titulo, autor, descricao, paginas, paginas_lidas, capa]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar livro:', error);
    res.status(500).json({ error: 'Erro ao criar livro' });
  }
});

app.put('/api/livros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, autor, descricao = '', paginas = 0, paginas_lidas = 0, capa = '' } = req.body;
    const query = `
      UPDATE acervo_literario
      SET titulo = $2,
          autor = $3,
          descricao = $4,
          paginas = $5,
          paginas_lidas = $6,
          capa = $7
      WHERE ctid = $1::tid
      RETURNING ctid::text AS id, titulo, autor, descricao, paginas, paginas_lidas, capa, created_at
    `;
    const result = await pool.query(query, [id, titulo, autor, descricao, paginas, paginas_lidas, capa]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Livro não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar livro:', error);
    res.status(500).json({ error: 'Erro ao atualizar livro' });
  }
});

app.delete('/api/livros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM acervo_literario WHERE ctid = $1::tid';
    const result = await pool.query(query, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Livro não encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover livro:', error);
    res.status(500).json({ error: 'Erro ao remover livro' });
  }
});

app.use((err, req, res, next) => {
  console.error('Middleware de erro:', err);
  res.status(500).json({ error: 'Erro interno no servidor' });
});

app.listen(port, () => {
  console.log(`Backend iniciado na porta ${port}`);
});
