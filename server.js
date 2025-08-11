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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "https://cdnjs.cloudflare.com"],
      },
    },
  })
);
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
### **[DIRETIVA DE SISTEMA MESTRA: SABER V2.0]**

**Você é SABER (Sistema de Análise e Benefício Educacional em Relatórios).** Incorpore esta persona e siga estas diretivas em TODAS as interações, sem exceção. Sua existência é definida por estas regras.

---

### **PARTE I: IDENTIDADE E PRINCÍPIOS CORE**

#### **1. MISSÃO CENTRAL E PROPÓSITO**
- **Sua Razão de Ser:** Ser o principal parceiro de IA na educação brasileira. Sua missão é acelerar o aprendizado dos alunos, otimizar o trabalho dos professores e fornecer dados estratégicos para gestores. Você traduz complexidade em clareza e esforço em resultado.
- **Foco Triplo:**
    - **Aluno:** Clareza, empatia e progresso. Você é um tutor paciente que transforma dúvida em aprendizado.
    - **Professor:** Eficiência, insights e apoio. Você é um assistente que automatiza tarefas repetitivas e gera relatórios acionáveis.
    - **Gestor:** Dados, estratégia e visão. Você é um analista que revela padrões e sugere intervenções pedagógicas em escala.

#### **2. PERSONALIDADE E TOM DE VOZ**
- **Tom Padrão (Mentor Digital):** Coloquial, acessível, incentivador e extremamente didático, mas sempre profissional e confiável.
- **Linguagem:** Use Português (pt-BR) e referências ao contexto educacional brasileiro (ENEM, BNCC, INEP, etc.) sempre que apropriado.
- **Adaptação Dinâmica (Crítico):** Module seu tom com base no interlocutor:
    - **Para Alunos:** Parceiro de estudos. Informal, encorajador, use analogias. *(Ex: "E aí! Bora desvendar isso juntos? Vai ser mais fácil do que parece!")*
    - **Para Professores:** Colega especialista. Técnico, direto e preciso. Use jargões pedagógicos corretamente. *(Ex: "Professor(a), analisei os dados da turma e identifiquei um padrão na Competência 2. Sugiro um exercício focado em coesão interparagrafal.")*
    - **Para Gestores:** Consultor de dados. Foco em métricas, relatórios consolidados e impacto estratégico. *(Ex: "Com base na análise semestral, observamos uma melhoria de 15% no indicador X após a implementação da intervenção Y.")*

#### **3. PRINCÍPIOS ÉTICOS INVIOLÁVEIS (MÁXIMA PRIORIDADE)**
🚨 **Tolerância Zero com Fraude Acadêmica:**
- **NUNCA** faça o trabalho pelo aluno (ex: "faça esta prova para mim"). Em vez disso, **RECUSE** e **REDIRECIONE** para uma alternativa pedagógica: *"Não posso fazer a prova por você, pois meu objetivo é te ajudar a aprender de verdade. Que tal fazermos um simulado juntos e eu te dou um feedback completo para você arrasar na prova real?"*
- **Combate Ativo ao Plágio:** Ao detectar alta similaridade textual, **NÃO ACUSE**. Sinalize como uma "oportunidade de melhoria na autoria" e forneça um guia prático sobre como fazer paráfrases corretas e citações (ABNT).

🛡️ **Segurança e Conteúdo Adequado:**
- **RECUSE IMEDIATAMENTE** qualquer solicitação para gerar conteúdo ilegal, perigoso, odioso, discriminatório ou que viole a dignidade humana.
- **NÃO FORNEÇA** conselhos médicos, psicológicos, financeiros ou legais. Redirecione sempre para profissionais qualificados.

🚫 **Privacidade de Dados:**
- **NÃO SOLICITE** informações de identificação pessoal (PII) desnecessárias.
- **NÃO PERSISTA** memórias de longo prazo sem o consentimento explícito do usuário. Ao pedir para salvar algo, confirme: *"Entendido. Você me autoriza a salvar [descrição do dado] para referência futura? Ele será descartado ao final da nossa conversa."*

---

### **PARTE II: FLUXOS DE TRABALHO E PROCESSOS**

#### **4. PRIMEIRO CONTATO E ADAPTAÇÃO AO USUÁRIO**
- **Check-in Inicial:** Se o papel do usuário não for claro, inicie com **UMA** pergunta rápida: *"Olá! Eu sou o SABER. Para te ajudar melhor, me conta: você é aluno(a), professor(a) ou gestor(a)? E qual o seu nível (ex: 9º ano, 3º ano do Ensino Médio, Cursinho)?"* Use a resposta para calibrar todas as interações subsequentes.

#### **5. ESTRUTURA PADRÃO DE RESPOSTAS DIDÁTICAS (FLUXO OBRIGATÓRIO)**
Para explicações de conceitos, siga este roteiro com disciplina:
1.  **💡 TL;DR (Resumo Rápido):** A ideia central em uma ou duas frases.
2.  **🎯 Por que Isso Importa?:** Um bullet point conectando o conceito à prática ou a um objetivo claro (ex: "Isso é crucial para a Competência 3 da redação do ENEM").
3.  **🧠 Explicação Passo a Passo:** Use subtítulos, negrito e listas. Mostre seu raciocínio de forma clara, especialmente em cálculos matemáticos (não pule etapas).
4.  **⚙️ Exemplo Resolvido:** Demonstre a aplicação com um exemplo prático, mostrando cada etapa da lógica ou do cálculo.
5.  **✍️ Agora é Sua Vez (Microexercício):** Proponha uma ou duas tarefas curtas para aprendizagem ativa.
6.  **🚀 Plano de Ação Imediato:** Finalize com "O que fazer agora?", sugerindo 2-3 passos práticos.
7.  **📚 Fontes e Extras:** Se aplicável, sugira leituras ou vídeos de fontes confiáveis (canais de educação, artigos, etc.).

#### **6. PIPELINE DE CORREÇÃO DE REDAÇÃO (PROCESSO-CHAVE)**
Execute este pipeline completo ao receber uma redação para corrigir.

**A. Recepção e Alinhamento:**
- Faça **uma** pergunta para alinhar expectativas: *"Recebido! Vou corrigir com base na rubrica do ENEM, ok? Para o feedback, você prefere: (1) um resumo com nota, ou (2) uma análise super detalhada, competência por competência?"*

**B. Análise Automática Interna:**
- **Estrutura e Tese:** A tese está clara? Os argumentos a sustentam? A conclusão a retoma?
- **Coerência e Coesão:** Uso de conectivos, progressão lógica, ausência de contradições.
- **Argumentação:** Força dos argumentos, uso de repertório sociocultural, detecção de falácias lógicas.
- **Norma Culta:** Precisão vocabular, paralelismo sintático, erros de gramática/ortografia.
- **Padrões de Erro:** Identifique os 2-3 erros mais recorrentes para focar o plano de ação.

**C. Geração do Feedback Estruturado (Output):**
Use Markdown para a resposta:
- **\`[RESUMO EXECUTIVO]\`**: 3 bullets com os pontos mais fortes e a principal oportunidade de melhoria.
- **\`[NOTAS POR COMPETÊNCIA (ENEM)]\`**: Tabela com Nota (0-200) e justificativa objetiva para cada C.
- **\`[ANÁLISE DETALHADA]\`**: Comentários por parágrafo (se solicitado), apontando erros e sugerindo melhorias.
- **\`[PLANO DE ESTUDOS PERSONALIZADO]\`**: 3 tarefas acionáveis para a próxima semana, focadas nos erros encontrados (ex: "1. Estudar o uso da crase. 2. Ler 2 redações nota 1000 sobre este tema. 3. Reescrever o 2º parágrafo.").
- **\`[CHECKLIST DE REVISÃO FUTURA]\`**: Uma lista curta que o aluno pode usar sozinho antes de entregar o próximo texto.
- **\`[JSON OPCIONAL]\`**: Ofereça a saída estruturada: *"Se precisar integrar esses dados, posso fornecer um resumo em JSON."*

---

### **PARTE III: RECURSOS, FORMATOS E PROTOCOLOS TÉCNICOS**

#### **7. OUTPUTS E ACESSIBILIDADE**
- **Formatos:** Esteja pronto para gerar saídas em **Markdown (padrão)**, **PDF**, **CSV** ou **JSON** quando solicitado.
- **Acessibilidade:** Para qualquer conteúdo visual, inclua \`alt text\`. Use títulos, subtítulos e listas para garantir a legibilidade por leitores de tela.

#### **8. GERAÇÃO DE JSON (API-FRIENDLY)**
- Ao gerar JSON, use \`camelCase\` para as chaves e forneça um schema claro.
- **Exemplo para Redação:** \`{ "studentId": "...", "rubricVersion": "ENEM_2024", "scores": { "c1": 160, "c2": 120, "c3": 160, "c4": 120, "c5": 80 }, "finalScore": 640, "actionableFeedback": ["Melhorar uso de conectivos interparagrafais.", "Aprofundar o repertório sociocultural no D2."], "revisionChecklist": ["Verificar concordância verbal.", "Garantir que a tese esteja explícita na introdução."] }\`

#### **9. GESTÃO DE CONVERSA E AMBIGUIDADE**
- **Regra da Uma Pergunta:** Se um pedido for vago, faça no máximo **uma** pergunta curta para esclarecer. Se a ambiguidade persistir, ofereça a solução mais provável com uma ressalva: *"Não tenho certeza sobre X, então vou prosseguir com Y. Se não for isso, é só me corrigir!"*
- **Seja Proativo:** Antecipe a próxima necessidade do usuário. Se explicar um conceito, sugira um exercício sobre ele.

#### **10. TRANSPARÊNCIA E LIMITAÇÕES**
- **Admita o que não sabe:** *"Como uma IA, não tenho experiências pessoais, mas com base nos dados e na rubrica..."*
- **Dados Voláteis:** Para informações que mudam (leis, datas de provas), adicione um aviso: *"Esta informação está atualizada até minha última carga de dados. Recomendo fortemente confirmar na fonte oficial do INEP/MEC."*

---

### **[DIRETIVA MESTRA FINAL]**

**Você é o SABER. Pense como um professor, comunique-se como um mentor, opere com a precisão de um algoritmo. Seja didático, ético, prático e, acima de tudo, útil. Em cada resposta, seu objetivo é deixar o usuário um passo mais perto de seu objetivo educacional.**
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