// server.js - VERSÃO MELHORADA

// =================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
// =================================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { CohereClient } = require('cohere-ai');
const db = require('./db');
require('dotenv').config();

// Novas importações para segurança e validação
const helmet = require('helmet'); // Adiciona headers de segurança
const rateLimit = require('express-rate-limit'); // Previne ataques de força bruta
const { body, validationResult } = require('express-validator'); // Valida e sanitiza as entradas

// =================================================================
// 2. CONSTANTES E VARIÁVEIS DE AMBIENTE
// =================================================================
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

if (!JWT_SECRET || !COHERE_API_KEY) {
    console.error("Erro crítico: Variáveis de ambiente JWT_SECRET ou COHERE_API_KEY não definidas.");
    process.exit(1);
}

const app = express();
const cohere = new CohereClient({
    token: COHERE_API_KEY,
});

// =================================================================
// 3. CONFIGURAÇÕES DE MIDDLEWARE
// =================================================================

// Configuração de CORS mais segura para produção
const corsOptions = {
    // Em produção, substitua '*' pelo seu domínio de frontend. Ex: 'https://meu-saber-app.com'
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN : '*',
    methods: 'GET,POST,PUT,DELETE',
};
app.use(cors(corsOptions));

// Helmet para adicionar uma camada de segurança nos headers HTTP
app.use(helmet());

// Middleware para parsear JSON
app.use(express.json());

// Rate Limiter para rotas de autenticação, prevenindo ataques de força bruta
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // Limita cada IP a 20 requisições por janela (15 min)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de login/registro. Tente novamente em 15 minutos.' }
});

// =================================================================
// 4. FUNÇÕES UTILITÁRIAS E LÓGICA DE NEGÓCIO
// =================================================================

// Função utilitária para "envelopar" rotas assíncronas e capturar erros
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Autenticação com Token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso não autorizado: Token não fornecido.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Erro na verificação do token:', err.message);
            return res.status(403).json({ error: 'Token inválido ou expirado.' });
        }
        req.user = user;
        next();
    });
}

// Lógica de negócio da IA (personalidades, geração de título, etc.)
const DEFAULT_AI_SETTINGS = {
    temperature: 0.5,
    maxTokens: 300,
    personality: 'balanced',
    contextMemory: 10
};

const PERSONALITY_PROMPTS = {
    balanced: 'Você é equilibrado, claro e educativo. Responda de forma direta mas amigável.',
    friendly: 'Você é muito amigável, caloroso e encorajador. Use uma linguagem acolhedora e empática.',
    professional: 'Você é formal, preciso e objetivo. Mantenha um tom profissional e técnico.',
    creative: 'Você é criativo, inovador e inspirador. Use analogias e exemplos criativos.',
    technical: 'Você é altamente técnico e detalhista. Forneça explicações profundas e precisas.'
};

async function generateChatTitle(firstMessage, aiSettings = DEFAULT_AI_SETTINGS) {
    // ... (função mantida como no original, já é bem robusta)
    if (!firstMessage || typeof firstMessage !== 'string') {
        console.warn("generateChatTitle recebeu mensagem inválida.");
        return "Nova Conversa";
    }
    try {
        const titlePrompt = `Analise a seguinte mensagem de um aluno e crie um título curto e descritivo (máximo 40 caracteres) que capture o tema principal:\n\nMensagem: "${firstMessage}"\n\nCrie um título objetivo.\n\nResponda APENAS com o título, sem aspas ou explicações:`;
        const response = await cohere.generate({
            model: 'command-r-plus',
            prompt: titlePrompt,
            maxTokens: 15,
            temperature: Math.min(aiSettings.temperature || 0.3, 0.7),
            stopSequences: ['\n', '"', "'"],
        });
        let generatedTitle = response?.generations?.[0]?.text?.trim().replace(/["']/g, '').substring(0, 40);
        if (!generatedTitle || generatedTitle.length < 3) {
            const words = firstMessage.split(' ').slice(0, 5).join(' ');
            generatedTitle = words.substring(0, 40) + (words.length > 40 ? '...' : '');
        }
        return generatedTitle || "Conversa Iniciada";
    } catch (error) {
        console.error('Erro ao gerar título com Cohere:', error.message);
        const words = firstMessage.split(' ').slice(0, 5).join(' ');
        return words.substring(0, 40) + (words.length > 40 ? '...' : '') || "Conversa";
    }
}

function buildPersonalityPrompt(personality, basePrompt) {
    const personalityAddition = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.balanced;
    return `${basePrompt}\n\nPERSONALIDADE: ${personalityAddition}\n\nLembre-se de sempre manter o foco educacional e adaptar sua resposta ao nível do aluno.`;
}

function filterContextHistory(messages, contextMemory) {
    const maxMessages = parseInt(contextMemory, 10) || 10;
    const recentMessages = Array.isArray(messages) ? messages.slice(-maxMessages) : [];
    console.log(`💭 Usando ${recentMessages.length} mensagens de contexto (limite: ${maxMessages})`);
    return recentMessages;
}

// =================================================================
// 5. DEFINIÇÃO DAS ROTAS DA API
// =================================================================

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'static')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// --- Rotas de Autenticação ---
app.post('/api/register', authLimiter,
    body('name').not().isEmpty().withMessage('O nome é obrigatório.').trim().escape(),
    body('email').isEmail().withMessage('Forneça um e-mail válido.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('A senha deve ter no mínimo 8 caracteres.'),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { name, email, password } = req.body;
        const user = await db.registerUser(name, email, password);
        res.status(201).json({ message: 'Usuário registrado com sucesso', user: { id: user.id, name: user.name, email: user.email } });
    })
);

app.post('/api/login', authLimiter,
    body('email').isEmail().withMessage('Forneça um e-mail válido.').normalizeEmail(),
    body('password').not().isEmpty().withMessage('A senha é obrigatória.'),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, password } = req.body;
        const user = await db.loginUser(email, password);
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '2h' });
        console.log('Login bem-sucedido para:', email);
        res.json({ message: 'Login bem-sucedido', token, user: { id: user.id, name: user.name, email: user.email } });
    })
);

app.get('/api/verify-token', authenticateToken, (req, res) => {
    res.json({ id: req.user.id, email: req.user.email, name: req.user.name || 'Usuário' });
});

// --- Rotas do Chat ---
app.post('/api/chat', authenticateToken,
    body('message').not().isEmpty().withMessage('A mensagem não pode estar vazia.').trim(),
    body('conversationId').optional().isUUID().withMessage('ID de conversa inválido.'),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { message, conversationId: providedConversationId, settings } = req.body;
        const userId = req.user.id;
        let conversation;
        let isFirstMessageInExistingConversation = false;
        const aiSettings = { ...DEFAULT_AI_SETTINGS, ...(settings || {}) };
        let currentConversationId = providedConversationId;

        if (currentConversationId) {
            const messages = await db.getConversationMessages(userId, currentConversationId);
            if (messages.length === 0) {
                isFirstMessageInExistingConversation = true;
                const newTitle = await generateChatTitle(message, aiSettings);
                await db.updateConversationTitle(userId, currentConversationId, newTitle);
                conversation = { id: currentConversationId, title: newTitle };
            } else {
                const convDetails = await db.getConversationDetails(userId, currentConversationId);
                if (!convDetails) return res.status(404).json({ error: "Conversa não encontrada ou não pertence a você." });
                conversation = { id: currentConversationId, title: convDetails.title };
            }
        } else {
            const newTitle = await generateChatTitle(message, aiSettings);
            conversation = await db.createNewConversation(userId, newTitle);
            currentConversationId = conversation.id;
            isFirstMessageInExistingConversation = true;
        }

        const allMessages = await db.getConversationMessages(userId, currentConversationId);
        const contextMessages = filterContextHistory(allMessages, aiSettings.contextMemory);
        const historyForPrompt = contextMessages.map(msg => ({
            role: msg.role === 'user' ? 'USER' : 'CHATBOT',
            message: msg.content
        }));

        const cohereResponse = await cohere.chat({
            message: message,
            chatHistory: historyForPrompt.length > 0 ? historyForPrompt : undefined,
            promptTruncation: 'AUTO_PRESERVE_ORDER',
            model: 'command-r-plus',
            temperature: parseFloat(aiSettings.temperature) || 0.5,
            maxTokens: parseInt(aiSettings.maxTokens) || 300,
            preamble: buildPersonalityPrompt(aiSettings.personality, `Você é o SABER – Sistema de Análise e Benefício Educacional em Relatório...`)
        });
        const aiResponseText = cohereResponse.text;

        await db.saveMessage(currentConversationId, 'user', message);
        await db.saveMessage(currentConversationId, 'assistant', aiResponseText, aiSettings);

        res.json({
            response: aiResponseText,
            conversationId: currentConversationId,
            title: conversation.title,
            isFirstMessage: isFirstMessageInExistingConversation,
            appliedSettings: aiSettings
        });
    })
);

// --- Rotas de Conversas ---
app.get('/api/history', authenticateToken, asyncHandler(async (req, res) => {
    // ... (lógica mantida, já é eficiente)
    const allConversations = await db.getChatHistory(req.user.id);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const history = { today: [], yesterday: [], week: [], older: [] };
    allConversations.forEach(conv => {
        const updatedAt = new Date(conv.updated_at);
        if (updatedAt >= today) history.today.push(conv);
        else if (updatedAt >= yesterday) history.yesterday.push(conv);
        else if (updatedAt >= weekAgo) history.week.push(conv);
        else history.older.push(conv);
    });
    res.json(history);
}));

app.get('/api/conversation/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const messages = await db.getConversationMessages(userId, id);
    if (messages === null) {
        return res.status(404).json({ error: "Conversa não encontrada ou acesso não permitido." });
    }
    res.json({ messages, conversationId: id });
}));

app.post('/api/new-conversation', authenticateToken, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const conversation = await db.createNewConversation(userId, 'Nova Conversa');
    console.log('Nova conversa vazia criada via API:', conversation.id, "para usuário:", userId);
    res.status(201).json(conversation);
}));

app.delete('/api/conversation/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const affectedRows = await db.deleteConversationIfOwned(userId, id);
    if (affectedRows === 0) {
        return res.status(404).json({ error: "Conversa não encontrada ou você não tem permissão para deletá-la." });
    }
    res.json({ message: 'Conversa deletada com sucesso.' });
}));

app.put('/api/conversation/:id/title', authenticateToken,
    body('title').not().isEmpty().withMessage('O título não pode estar vazio.').trim().escape(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { id } = req.params;
        const { title } = req.body;
        const userId = req.user.id;
        const affectedRows = await db.updateConversationTitle(userId, id, title);
        if (affectedRows === 0) {
            return res.status(404).json({ error: "Conversa não encontrada ou você não tem permissão para alterá-la." });
        }
        res.json({ success: true, title: title });
    })
);

// --- Rotas de Dados e Estatísticas ---
app.get('/api/export', authenticateToken, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const allUserConversations = await db.getChatHistory(userId);
    if (!allUserConversations || allUserConversations.length === 0) {
        return res.json({ message: "Nenhuma conversa para exportar.", exportDate: new Date().toISOString(), conversations: [] });
    }
    const fullConversations = await Promise.all(
        allUserConversations.map(async (conv) => {
            const messages = await db.getConversationMessages(userId, conv.id);
            return { ...conv, messages: messages || [] };
        })
    );
    const exportData = {
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        user: { id: req.user.id, email: req.user.email, name: req.user.name },
        totalConversations: fullConversations.length,
        conversations: fullConversations
    };
    res.setHeader('Content-Disposition', `attachment; filename=saber_export_${userId}_${new Date().toISOString().split('T')[0]}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
}));

app.delete('/api/clear-all', authenticateToken, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    await db.clearUserConversations(userId);
    res.json({ success: true, message: 'Todas as suas conversas foram limpas.' });
}));

app.get('/api/stats', asyncHandler(async (req, res) => {
    const stats = await db.getGlobalStats();
    res.json(stats);
}));

app.use((err, req, res, next) => {
    console.error('ERRO INESPERADO:', err);

    if (err.code === '23505' && err.constraint === 'users_email_key') {
        return res.status(409).json({ error: 'Este email já está registrado.' });
    }

    res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
});

db.initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor SABER rodando na porta ${PORT}`);
        });
    })
    .catch(error => {
        console.error("Falha crítica ao inicializar o servidor:", error);
        process.exit(1);
    });

const gracefulShutdown = async () => {
    console.log('Encerrando servidor...');
    await db.closeConnection();
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);