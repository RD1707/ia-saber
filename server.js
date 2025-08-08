const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { CohereClient } = require('cohere-ai');
const db = require('./db'); 
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000; 

db.initializeDatabase().catch(error => {
    console.error("Falha crítica ao inicializar banco de dados:", error);
    process.exit(1);
});

app.use(cors());
app.use(express.json());

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) {
        return res.status(401).json({ error: 'Acesso não autorizado: Token não fornecido.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Erro na verificação do token:', err.message);
            return res.status(403).json({ error: 'Token inválido ou expirado.' });
        }
        req.user = user; //
        next();
    });
}

const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY,
});

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
    if (!firstMessage || typeof firstMessage !== 'string') {
        console.warn("generateChatTitle recebeu mensagem inválida.");
        return "Nova Conversa";
    }
    try {
        const titlePrompt = `
Analise a seguinte mensagem de um aluno e crie um título curto e descritivo (máximo 40 caracteres) que capture o tema principal:

Mensagem: "${firstMessage}"

Crie um título objetivo.

Responda APENAS com o título, sem aspas ou explicações:`;

        const response = await cohere.generate({
            model: 'command-r-plus', 
            prompt: titlePrompt,
            maxTokens: 15, // Suficiente para um título curto
            temperature: Math.min(aiSettings.temperature || 0.3, 0.7),
            stopSequences: ['\n', '"', "'"],
        });

        let generatedTitle = response?.generations?.[0]?.text?.trim();
        if (generatedTitle) {
            generatedTitle = generatedTitle.replace(/["']/g, '').substring(0, 40);
        }

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
    const maxMessages = parseInt(contextMemory, 10) || 10; // Garante que é um número
    const recentMessages = Array.isArray(messages) ? messages.slice(-maxMessages) : [];
    console.log(`💭 Usando ${recentMessages.length} mensagens de contexto (limite: ${maxMessages})`);
    return recentMessages;
}

app.use(express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Nome, email e senha são obrigatórios." });
    }
    try {
        const user = await db.registerUser(name, email, password);
        res.status(201).json({ message: 'Usuário registrado com sucesso', user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error('Erro no registro:', err.message);
        if (err.message && err.message.includes('duplicate key value violates unique constraint "users_email_key"')) {
            return res.status(409).json({ error: 'Este email já está registrado.' });
        }
        res.status(500).json({ error: 'Erro interno ao registrar usuário.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email e senha são obrigatórios." });
    }
    try {
        const user = await db.loginUser(email, password);
        if (!user) {
            console.log('Credenciais inválidas para:', email);
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '2h' } // Token expira em 2 horas
        );

        console.log('Login bem-sucedido para:', email);
        res.json({
            message: 'Login bem-sucedido',
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('Erro no login:', err.message);
        res.status(500).json({ error: 'Erro interno no servidor durante o login.' });
    }
});

app.post('/api/chat', authenticateToken, async (req, res) => {
    try {
        const { message, conversationId: providedConversationId, settings } = req.body;
        const userId = req.user.id; // ID do usuário autenticado
        let conversation;
        let isFirstMessageInExistingConversation = false;

        if (!message || typeof message !== 'string' || message.trim() === "") {
            return res.status(400).json({ error: "A mensagem não pode estar vazia." });
        }

        const aiSettings = { ...DEFAULT_AI_SETTINGS, ...(settings || {}) };

        console.log(' Chat request recebido:', {
            userId: userId,
            message: message.substring(0, 50) + '...',
            conversationId: providedConversationId || 'novo',
            settings: aiSettings
        });

        let currentConversationId = providedConversationId;

        if (currentConversationId) {

            const messages = await db.getConversationMessages(userId, currentConversationId);

            if (messages.length === 0) {
                // Conversa existe mas está vazia, pode ser a primeira mensagem real.
                isFirstMessageInExistingConversation = true;
                const newTitle = await generateChatTitle(message, aiSettings);
                // Atualiza o título da conversa existente
                await db.updateConversationTitle(userId, currentConversationId, newTitle);
                conversation = { id: currentConversationId, title: newTitle };
            } else {
                // Conversa existente com mensagens
                const convDetails = await db.getConversationDetails(userId, currentConversationId); // Necessário criar esta função em db.js
                if (!convDetails) {
                    return res.status(404).json({ error: "Conversa não encontrada ou não pertence a você." });
                }
                conversation = { id: currentConversationId, title: convDetails.title };
            }
        } else {

            const newTitle = await generateChatTitle(message, aiSettings);
            conversation = await db.createNewConversation(userId, newTitle);
            currentConversationId = conversation.id; // Atualiza o ID da conversa atual
            isFirstMessageInExistingConversation = true; // É a primeira mensagem da nova conversa
        }

        console.log(' Usando conversa:', currentConversationId, "Título:", conversation.title);

        // Busca todas as mensagens da conversa atual para o histórico do prompt
        const allMessages = await db.getConversationMessages(userId, currentConversationId);
        const contextMessages = filterContextHistory(allMessages, aiSettings.contextMemory);

        const historyForPrompt = contextMessages.map(msg => ({
            role: msg.role === 'user' ? 'USER' : 'CHATBOT', // Cohere espera USER e CHATBOT
            message: msg.content
        }));
        
        const cohereResponse = await cohere.chat({
            message: message,
            chatHistory: historyForPrompt.length > 0 ? historyForPrompt : undefined, // Envia histórico se existir
            promptTruncation: 'AUTO_PRESERVE_ORDER',
            model: 'command-r-plus',
            temperature: parseFloat(aiSettings.temperature) || 0.5,
            maxTokens: parseInt(aiSettings.maxTokens) || 300,
            // Adicionar preamble com a personalidade aqui
            preamble: buildPersonalityPrompt(aiSettings.personality, `Você é o SABER – Sistema de Análise e Benefício Educacional em Relatório...`)

        });

        const aiResponseText = cohereResponse.text;

        // Salva a mensagem do usuário e a resposta da IA
        await db.saveMessage(currentConversationId, 'user', message);
        await db.saveMessage(currentConversationId, 'assistant', aiResponseText, aiSettings);

        console.log('Chat processado com sucesso. Resposta da IA:', aiResponseText.substring(0, 50) + "...");

        res.json({
            response: aiResponseText,
            conversationId: currentConversationId,
            title: conversation.title, // Envia o título atualizado ou da nova conversa
            isFirstMessage: isFirstMessageInExistingConversation, // Indica se é a "primeira mensagem que define o título"
            appliedSettings: aiSettings
        });

    } catch (error) {
        console.error('Erro ao processar chat:', error);
        res.status(500).json({ error: 'Erro interno ao processar sua mensagem.' });
    }
});


// Rota para buscar histórico de conversas
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Erro ao buscar histórico:', error.message);
        res.status(500).json({ error: 'Erro ao buscar histórico de conversas.' });
    }
});

// Rota para buscar mensagens de uma conversa específica
app.get('/api/conversation/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const messages = await db.getConversationMessages(userId, id);
        if (messages === null) { 
            return res.status(404).json({ error: "Conversa não encontrada ou acesso não permitido." });
        }
        res.json({ messages, conversationId: id }); // Retorna messages e o ID da conversa
    } catch (error) {
        console.error('Erro ao buscar mensagens da conversa:', error.message);
        res.status(500).json({ error: 'Erro ao buscar mensagens da conversa.' });
    }
});

// Rota para criar uma nova conversa vazia
app.post('/api/new-conversation', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const conversation = await db.createNewConversation(userId, 'Nova Conversa');
        console.log('Nova conversa vazia criada via API:', conversation.id, "para usuário:", userId);
        res.status(201).json(conversation); // Status 201 Created
    } catch (error) {
        console.error('Erro ao criar nova conversa vazia:', error.message);
        res.status(500).json({ error: 'Erro ao criar nova conversa.' });
    }
});

// Rota para deletar uma conversa
app.delete('/api/conversation/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const affectedRows = await db.deleteConversationIfOwned(userId, id); // CRIAR esta função em db.js
        if (affectedRows === 0) {
            return res.status(404).json({ error: "Conversa não encontrada ou você não tem permissão para deletá-la." });
        }
        res.json({ message: 'Conversa deletada com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar conversa:', error.message);
        res.status(500).json({ error: 'Erro ao deletar conversa.' });
    }
});

app.put('/api/conversation/:id/title', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params; // ID da conversa
        const { title } = req.body;
        const userId = req.user.id;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ error: 'O título não pode estar vazio.' });
        }
        // db.updateConversationTitle já foi corrigido para aceitar (userId, conversationId, newTitle)
        const affectedRows = await db.updateConversationTitle(userId, id, title.trim());
         if (affectedRows === 0) { // Supondo que updateConversationTitle retorne o número de linhas afetadas
            return res.status(404).json({ error: "Conversa não encontrada ou você não tem permissão para alterá-la." });
        }
        console.log(` Título da conversa ${id} atualizado para "${title.trim()}" pelo usuário ${userId}`);
        res.json({ success: true, title: title.trim() });
    } catch (error) {
        console.error(' Erro ao atualizar título da conversa:', error.message);
        res.status(500).json({ error: 'Erro ao atualizar título da conversa.' });
    }
});

// Rota de estatísticas (pública ou protegida, dependendo da necessidade)
app.get('/api/stats', async (req, res) => { // Se precisar ser protegida, adicionar authenticateToken
    try {
        // Estas são estatísticas globais, podem não precisar de autenticação de usuário específico
        const stats = await db.getGlobalStats(); // CRIAR esta função em db.js
        console.log('Estatísticas globais enviadas.');
        res.json(stats);
    } catch (error) {
        console.error('Erro ao buscar estatísticas globais:', error.message);
        res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
    }
});

// Rota para verificação de token
app.get('/api/verify-token', authenticateToken, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name || 'Usuário' // Garante que name sempre tenha um valor
    });
});

// Rota para exportar conversas DO USUÁRIO LOGADO
app.get('/api/export', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`📥 Exportando dados para o usuário: ${userId}`);

        const allUserConversations = await db.getChatHistory(userId);
        if (!allUserConversations || allUserConversations.length === 0) {
            return res.json({
                message: "Nenhuma conversa para exportar.",
                exportDate: new Date().toISOString(),
                conversations: []
            });
        }

        const fullConversations = await Promise.all(
            allUserConversations.map(async (conv) => {
                // db.getConversationMessages já verifica o userId
                const messages = await db.getConversationMessages(userId, conv.id);
                return { ...conv, messages: messages || [] }; // Garante que messages é um array
            })
        );

        const exportData = {
            exportDate: new Date().toISOString(),
            version: '2.0.0', // Pode vir do package.json
            user: { id: req.user.id, email: req.user.email, name: req.user.name },
            totalConversations: fullConversations.length,
            conversations: fullConversations
        };

        res.setHeader('Content-Disposition', `attachment; filename=saber_export_${userId}_${new Date().toISOString().split('T')[0]}.json`);
        res.setHeader('Content-Type', 'application/json');
        res.json(exportData);

        console.log(`Dados exportados com sucesso para o usuário: ${userId}, ${fullConversations.length} conversas.`);

    } catch (error) {
        console.error(` Erro ao exportar dados para usuário ${req.user?.id}:`, error.message);
        res.status(500).json({ error: 'Erro ao exportar seus dados.' });
    }
});

app.delete('/api/clear-all', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(` Limpando todas as conversas para o usuário: ${userId}`);
        // IMPORTANTE: Criar db.clearUserConversations(userId) em db.js
        // que deleta conversas ONDE user_id = userId.
        // A função db.clearAllConversations() como está deleta TUDO de todos.
        await db.clearUserConversations(userId); // Esta função precisa ser criada em db.js
        res.json({ success: true, message: 'Todas as suas conversas foram limpas.' });
        console.log(` Conversas limpas com sucesso para o usuário: ${userId}`);
    } catch (error) {
        console.error(` Erro ao limpar conversas para usuário ${req.user?.id}:`, error.message);
        res.status(500).json({ error: 'Erro ao limpar suas conversas.' });
    }
});


// Tratamento de Encerramento Gracioso
process.on('SIGINT', async () => {
    console.log(' Encerrando servidor (SIGINT)...');
    await db.closeConnection();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log(' Encerrando servidor (SIGTERM)...');
    await db.closeConnection();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(` Servidor SABER rodando na porta ${PORT}`);
});
