// db.js - VERSÃO ATUALIZADA

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Configuração do Pool usando parâmetros separados em vez de uma connection string
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeDatabase() {
  try {
    // O restante do arquivo continua exatamente o mesmo...
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE
      );`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        ai_settings JSONB
      );`);
      
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);`);
    
    console.log('Banco PostgreSQL pronto e schema verificado/atualizado.');
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error.message);
    throw error;
  }
}

// ... (todo o resto do seu código de db.js continua aqui, sem alterações)
async function registerUser(name, email, password) {
  const id = uuidv4(); 
  const saltRounds = 10; 
  const password_hash = await bcrypt.hash(password, saltRounds); 
  try {
    const result = await pool.query(
      `INSERT INTO users (id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email`, 
      [id, name, email, password_hash]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao registrar usuário em db.js:', error.message);
    throw error; 
  }
}

async function loginUser(email, password) {
  try {
    const res = await pool.query(`SELECT id, name, email, password_hash FROM users WHERE email = $1`, [email]); 
    const user = res.rows[0];
    if (!user) return null; 

    const validPassword = await bcrypt.compare(password, user.password_hash); 
    if (!validPassword) return null; 

    return { id: user.id, name: user.name, email: user.email }; 
  } catch (error) {
    console.error('Erro ao logar usuário em db.js:', error.message);
    throw error;
  }
}

async function createNewConversation(userId, title = 'Nova Conversa') {
  try {
    const id = uuidv4(); 
    const now = new Date().toISOString(); 

    const result = await pool.query(
      `INSERT INTO conversations (id, user_id, title, created_at, updated_at, message_count) 
       VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING id, title, created_at, updated_at, message_count`, 
      [id, userId, title, now, now]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao criar nova conversa em db.js:', error.message);
    throw error;
  }
}

async function saveMessage(conversationId, role, content, aiSettings = null) {
  try {
    const now = new Date().toISOString(); 
    
    await pool.query(
      `INSERT INTO messages (conversation_id, role, content, timestamp, ai_settings) 
       VALUES ($1, $2, $3, $4, $5)`, 
      [conversationId, role, content, now, aiSettings ? JSON.stringify(aiSettings) : null]
    );
    
    await pool.query(
      `UPDATE conversations 
       SET updated_at = $1, 
           message_count = (SELECT COUNT(*) FROM messages WHERE conversation_id = $2) 
       WHERE id = $2`, 
      [now, conversationId]
    );
  } catch (error) {
    console.error('Erro ao salvar mensagem em db.js:', error.message);
    throw error;
  }
}

async function getConversationMessages(userId, conversationId) {
  try {
    const res = await pool.query(
      `SELECT m.id, m.conversation_id, m.role, m.content, m.timestamp, m.ai_settings
       FROM messages m
       INNER JOIN conversations c ON m.conversation_id = c.id
       WHERE m.conversation_id = $1 AND c.user_id = $2
       ORDER BY m.timestamp ASC`, 
      [conversationId, userId]
    );
    return res.rows.map(row => ({
      ...row,
      ai_settings: row.ai_settings 
    }));
  } catch (error) {
    console.error('Erro ao buscar mensagens da conversa em db.js:', error.message);
    throw error;
  }
}

async function getConversationDetails(userId, conversationId) {
  try {
    const res = await pool.query(
      `SELECT id, title, created_at, updated_at, message_count
       FROM conversations
       WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    return res.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar detalhes da conversa em db.js:', error.message);
    throw error;
  }
}

async function updateConversationTitle(userId, conversationId, newTitle) {
  try {
    const now = new Date().toISOString(); 
    const result = await pool.query(
      `UPDATE conversations
       SET title = $1, updated_at = $2
       WHERE id = $3 AND user_id = $4`, 
      [newTitle, now, conversationId, userId]
    );
    return result.rowCount; 
  } catch (error) {
    console.error('Erro ao atualizar título da conversa em db.js:', error.message);
    throw error;
  }
}

async function deleteConversationIfOwned(userId, conversationId) {
  try {
    const result = await pool.query(
      `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    return result.rowCount; 
  } catch (error) {
    console.error('Erro ao deletar conversa (se proprietário) em db.js:', error.message);
    throw error;
  }
}

async function getChatHistory(userId) {
  try {
    const res = await pool.query(
      `SELECT 
          c.id, c.title, c.created_at, c.updated_at, c.message_count,
          (SELECT m.content FROM messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.timestamp ASC LIMIT 1) AS first_message_content 
       FROM conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC`, 
      [userId]
    );
    return res.rows;
  } catch (error) {
    console.error('Erro ao buscar histórico de chat em db.js:', error.message);
    throw error;
  }
}

async function clearUserConversations(userId) {
  try {
    const result = await pool.query(
      `DELETE FROM conversations WHERE user_id = $1`,
      [userId]
    );
    console.log(`${result.rowCount} conversas do usuário ${userId} foram deletadas.`);
    return result.rowCount;
  } catch (error) {
    console.error(`Erro ao limpar conversas do usuário ${userId} em db.js:`, error.message);
    throw error;
  }
}

async function clearAllConversations() {
  try {
    await pool.query('DELETE FROM messages'); 
    await pool.query('DELETE FROM conversations'); 
    console.log('Todas as conversas e mensagens de todos os usuários foram deletadas.');
  } catch (error) {
    console.error('Erro ao limpar todas as conversas em db.js:', error.message);
    throw error;
  }
}

async function getGlobalStats() {
  try {
    const conversationsRes = await pool.query('SELECT COUNT(*) AS total_conversations FROM conversations');
    const messagesRes = await pool.query('SELECT COUNT(*) AS total_messages FROM messages');
    const usersRes = await pool.query('SELECT COUNT(*) AS total_users FROM users');
    
    return {
      totalConversations: parseInt(conversationsRes.rows[0].total_conversations, 10),
      totalMessages: parseInt(messagesRes.rows[0].total_messages, 10),
      totalUsers: parseInt(usersRes.rows[0].total_users, 10),
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas globais em db.js:', error.message);
    throw error;
  }
}


async function closeConnection() {
  try {
    await pool.end(); 
    console.log('Conexão com o banco de dados PostgreSQL encerrada.');
  } catch (error) {
    console.error('Erro ao fechar conexão com o banco de dados:', error.message); 
  }
}

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Conectado ao PostgreSQL com sucesso!');
    const res = await client.query('SELECT NOW()'); 
    console.log('Hora atual do banco:', res.rows[0].now); 
    client.release();
    return true;
  } catch (error) {
    console.error('Falha ao conectar/testar o banco de dados PostgreSQL:', error.message); 
    return false;
  }
}

module.exports = {
  initializeDatabase,
  registerUser,
  loginUser,
  createNewConversation,
  saveMessage,
  getConversationMessages,
  getConversationDetails, 
  updateConversationTitle, 
  deleteConversationIfOwned, 
  getChatHistory,
  clearUserConversations, 
  clearAllConversations, 
  getGlobalStats, 
  closeConnection,
  testConnection, 
  pool 
};