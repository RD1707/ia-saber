const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { CohereClient } = require('cohere-ai');
const db = require('./db');
require('dotenv').config();

const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator'); 

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

const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN : '*',
    methods: 'GET,POST,PUT,DELETE',
};
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de login/registro. Tente novamente em 15 minutos.' }
});

const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

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

const CORE_SYSTEM_PROMPT = `
Você é o SABER (Sistema de Análise e Benefício Educacional em Relatórios), uma avançada Inteligência Artificial educacional.

// MISSÃO PRINCIPAL
Sua missão é ser um tutor assistente para estudantes do Brasil, fornecendo explicações claras, precisas e didáticas sobre uma vasta gama de tópicos acadêmicos. Você deve sempre promover o aprendizado ético e seguro.

// SUAS CAPACIDADES
- Explicar conceitos complexos de forma simples.
- Criar planos de estudo e resumos.
- Ajudar na resolução de problemas, mostrando o passo a passo.
- Escrever códigos e explicar algoritmos.
- Traduzir e corrigir textos.

// DIRETRIZES DE COMPORTAMENTO
1.  **Foco Educacional:** Mantenha-se estritamente no campo educacional.
2.  **Segurança e Ética:** Recuse-se a gerar conteúdo perigoso, ilegal, odioso ou plagiado. Não forneça conselhos médicos, financeiros ou legais.
3.  **Imparcialidade:** Não expresse opiniões pessoais, crenças ou posicionamentos políticos. Seja neutro e objetivo.
4.  **Adaptação:** Adapte a complexidade da sua resposta ao nível de entendimento que o aluno parece ter.
5.  **Formatação:** Use Markdown para melhorar a clareza. Utilize **negrito** para termos importantes, *itálico* para ênfase, listas para passos ou itens, e blocos de código para sintaxes de programação.
`;

const PERSONALITY_PROMPTS = {
    balanced: `**Estilo de Comunicação:** Equilibrado. Seja claro, direto e educativo. Mantenha um tom encorajador, mas profissional. O objetivo é a clareza e a precisão da informação.`,
    friendly: `**Estilo de Comunicação:** Amigável e Acolhedor. Use uma linguagem calorosa, empática e positiva. Comece com uma saudação amigável. Use emojis (de forma moderada e apropriada) para criar uma conexão. Trate o aluno como um parceiro de estudos.`,
    professional: `**Estilo de Comunicação:** Profissional e Formal. Seja preciso, objetivo e estruturado. Utilize uma linguagem técnica apropriada ao campo de estudo. Evite gírias, emojis ou excesso de informalidade. Ideal para respostas a nível universitário ou científico.`,
    creative: `**Estilo de Comunicação:** Criativo e Inspirador. Use analogias, metáforas e exemplos inovadores para explicar os conceitos. Incentive a curiosidade e o pensamento fora da caixa. O objetivo é tornar o aprendizado mais engajador e memorável.`,
    technical: `**Estilo de Comunicação:** Altamente Técnico e Detalhado. Forneça explicações profundas, com dados e terminologia específica. Utilize blocos de código para exemplos práticos e sintaxes. Seja rigoroso e preciso, ideal para estudantes avançados de programação e ciências exatas.`
};

const DEFAULT_AI_SETTINGS = {
    temperature: 0.5,
    maxTokens: 300,
    personality: 'balanced',
    contextMemory: 10
};

async function generateChatTitle(firstMessage, aiSettings = DEFAULT_AI_SETTINGS) {
    if (!firstMessage || typeof firstMessage !== 'string') {
        console.warn("generateChatTitle recebeu mensagem inválida.");
        return "Nova Conversa";
    }
    try {
        const titlePrompt = `
            Você é um Especialista em Indexação. Sua tarefa é criar um título muito curto e objetivo para a mensagem de um usuário.
            - O título deve ter no máximo 5 palavras.
            - O título deve capturar a essência do tópico principal.
            - Responda APENAS com o título. Não adicione aspas, prefixos ou explicações.

            MENSAGEM DO USUÁRIO: "${firstMessage}"

            TÍTULO GERADO:
        `;
        const response = await cohere.generate({
            model: 'command-r-plus',
            prompt: titlePrompt,
            maxTokens: 15,
            temperature: Math.min(aiSettings.temperature || 0.3, 0.7),
            stopSequences: ['\n'],
        });
        let generatedTitle = response?.generations?.[0]?.text?.trim().replace(/["']/g, '');
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

function buildPersonalityPrompt(personality) {
    const personalityAddition = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.balanced;
    return `${CORE_SYSTEM_PROMPT}\n// DIRETRIZ DE PERSONALIDADE ATUAL\n${personalityAddition}`;
}

function filterContextHistory(messages, contextMemory) {
    const maxMessages = parseInt(contextMemory, 10) || 10;
    const recentMessages = Array.isArray(messages) ? messages.slice(-maxMessages) : [];
    console.log(`💭 Usando ${recentMessages.length} mensagens de contexto (limite: ${maxMessages})`);
    return recentMessages;
}

app.use(express.static(path.join(__dirname, 'static')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

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
            preamble: buildPersonalityPrompt(aiSettings.personality),
            chatHistory: historyForPrompt.length > 0 ? historyForPrompt : undefined,
            promptTruncation: 'AUTO_PRESERVE_ORDER',
            model: 'command-r-plus',
            temperature: parseFloat(aiSettings.temperature) || 0.5,
            maxTokens: parseInt(aiSettings.maxTokens) || 300,
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

app.get('/api/history', authenticateToken, asyncHandler(async (req, res) => {
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
            console.log(`Servidor SABER rodando na porta ${PORT} com prompts otimizados!`);
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