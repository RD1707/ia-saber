document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SABER Chat App inicializando...');

    // Configuração do Marked.js para renderizar Markdown
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-',
        gfm: true,
        breaks: true,
    });

    // Seletores do DOM
    const DOM = {
        loginScreen: document.getElementById('loginScreen'),
        appContainer: document.getElementById('appContainer'),
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        loginTabs: document.querySelectorAll('.login-tab'),
        messageForm: document.getElementById('message-form'),
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        chatMessages: document.getElementById('chat-messages'),
        thinkingIndicator: document.getElementById('thinking'),
        stopGenerationBtn: document.getElementById('stop-generation-btn'),
        sidebar: document.getElementById('sidebar'),
        sidebarContent: document.getElementById('sidebarContent'),
        sidebarOverlay: document.getElementById('sidebarOverlay'),
        newChatBtn: document.getElementById('newChatBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        headerMenuBtn: document.getElementById('headerMenuBtn'),
        sidebarToggle: document.getElementById('sidebarToggle'),
        settingsModalOverlay: document.getElementById('settingsModalOverlay'),
        settingsModal: document.getElementById('settingsModal'),
        settingsCloseBtn: document.getElementById('settingsCloseBtn'),
        settingsTabs: document.querySelectorAll('.settings-tab'),
        settingsPanels: document.querySelectorAll('.settings-panel'),
        chatTitle: document.getElementById('chat-title'),
        userNameEl: document.querySelector('.user-name'),
        userInitialEl: document.getElementById('user-initial'),
    };

    // Estado da Aplicação
    let state = {
        currentConversationId: null,
        currentUser: null,
        chatHistory: { today: [], yesterday: [], week: [], older: [] },
        userSettings: {
            ai: { temperature: 0.5, maxTokens: 300, personality: 'balanced', contextMemory: 10 },
            interface: { theme: 'light', compactMode: false, soundNotifications: false },
            chat: { enterToSend: true }
        },
        abortController: null,
        lastUserMessage: null,
    };

    // --- FUNÇÕES PRINCIPAIS DE INICIALIZAÇÃO E EVENTOS ---

    async function initializeApp() {
        const token = localStorage.getItem('token');
        loadUserSettings();
        applySettings(); // Aplica tema e outros no início

        if (!token) {
            showLoginInterface();
        } else {
            try {
                const res = await fetch('/api/verify-token', { headers: { 'Authorization': `Bearer ${token}` } });
                if (!res.ok) throw new Error('Token inválido ou expirado');
                state.currentUser = await res.json();
                showChatInterface(state.currentUser);
            } catch (err) {
                console.error('Falha na verificação do token:', err);
                localStorage.removeItem('token');
                showLoginInterface();
            }
        }
        setupAllEventListeners();
        setupSidebarResponsiveness();
    }

    function setupAllEventListeners() {
        DOM.loginTabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
        DOM.loginForm?.addEventListener('submit', handleLogin);
        DOM.registerForm?.addEventListener('submit', handleRegister);
        DOM.logoutBtn?.addEventListener('click', handleLogout);
        DOM.messageForm?.addEventListener('submit', handleSubmit);
        DOM.messageInput?.addEventListener('input', autoResizeTextarea);
        DOM.messageInput?.addEventListener('keydown', handleKeyDown);
        DOM.newChatBtn?.addEventListener('click', handleNewConversationClick);
        DOM.headerMenuBtn?.addEventListener('click', toggleSidebar);
        DOM.sidebarToggle?.addEventListener('click', openSettingsModal);
        DOM.sidebarOverlay?.addEventListener('click', closeSidebar);
        DOM.stopGenerationBtn?.addEventListener('click', handleStopGeneration);
        DOM.themeToggleBtn?.addEventListener('click', toggleTheme);
        DOM.chatMessages?.addEventListener('click', handleMessageActions);
        DOM.sidebarContent?.addEventListener('click', handleHistoryActions);
        setupSettingsModal(); // Configura todos os eventos do modal
    }
    
    // --- LÓGICA DO MODAL DE CONFIGURAÇÕES ---

    function setupSettingsModal() {
        DOM.settingsCloseBtn?.addEventListener('click', closeSettingsModal);
        DOM.settingsModalOverlay?.addEventListener('click', (e) => {
            if (e.target === DOM.settingsModalOverlay) closeSettingsModal();
        });

        DOM.settingsTabs?.forEach(tab => {
            tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
        });

        setupSettingsControls();
        setupSpecialControls();

        document.getElementById('saveSettings')?.addEventListener('click', () => {
            saveUserSettings();
            closeSettingsModal();
        });
        document.getElementById('resetSettings')?.addEventListener('click', resetUserSettings);
    }

    function openSettingsModal() {
        updateSettingsUI();
        DOM.settingsModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSettingsModal() {
        DOM.settingsModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function switchSettingsTab(tabName) {
        DOM.settingsTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
        DOM.settingsPanels.forEach(panel => panel.classList.toggle('active', panel.id === `${tabName}-panel`));
    }

    function setupSettingsControls() {
        const tempSlider = document.getElementById("temperature");
        const tempValueDisplay = document.querySelector('.setting-item .setting-value');
        if (tempSlider && tempValueDisplay) {
            tempSlider.addEventListener("input", e => {
                const value = parseFloat(e.target.value);
                tempValueDisplay.textContent = value.toFixed(1);
                state.userSettings.ai.temperature = value;
            });
        }
        
        document.getElementById("maxTokens")?.addEventListener("change", e => state.userSettings.ai.maxTokens = parseInt(e.target.value, 10));
        document.getElementById("aiPersonality")?.addEventListener("change", e => state.userSettings.ai.personality = e.target.value);
        document.getElementById("theme")?.addEventListener("change", e => state.userSettings.interface.theme = e.target.value);
        document.getElementById("compactMode")?.addEventListener("change", e => state.userSettings.interface.compactMode = e.target.checked);
        document.getElementById("enterToSend")?.addEventListener("change", e => state.userSettings.chat.enterToSend = e.target.checked);
        document.getElementById("soundNotifications")?.addEventListener("change", e => state.userSettings.interface.soundNotifications = e.target.checked);
    }

    function setupSpecialControls() {
        document.getElementById("exportChats")?.addEventListener("click", exportConversations);
        document.getElementById("clearHistory")?.addEventListener("click", clearAllHistory);
    }

    function loadUserSettings() {
        try {
            const saved = localStorage.getItem("saber_settings");
            if (saved) {
                const parsed = JSON.parse(saved);
                // Mescla configurações salvas com as padrão para evitar erros se novas chaves forem adicionadas
                state.userSettings.ai = { ...state.userSettings.ai, ...parsed.ai };
                state.userSettings.interface = { ...state.userSettings.interface, ...parsed.interface };
                state.userSettings.chat = { ...state.userSettings.chat, ...parsed.chat };
            }
        } catch (e) {
            console.warn("Erro ao carregar configurações:", e);
        }
    }

    function saveUserSettings() {
        try {
            localStorage.setItem("saber_settings", JSON.stringify(state.userSettings));
            applySettings(); // Aplica as configurações salvas imediatamente
        } catch (e) {
            console.error("Erro ao salvar configurações:", e);
        }
    }

    function resetUserSettings() {
        if (confirm("Tem certeza que deseja restaurar as configurações padrão?")) {
            // Redefine para os valores padrão
            state.userSettings = {
                ai: { temperature: 0.5, maxTokens: 300, personality: 'balanced', contextMemory: 10 },
                interface: { theme: 'light', compactMode: false, soundNotifications: false },
                chat: { enterToSend: true }
            };
            updateSettingsUI(); // Atualiza a UI para refletir a redefinição
            saveUserSettings(); // Salva as configurações padrão
            alert("Configurações restauradas para o padrão.");
        }
    }

    function updateSettingsUI() {
        const tempSlider = document.getElementById("temperature");
        if (tempSlider) tempSlider.value = state.userSettings.ai.temperature;
        
        const tempValueDisplay = document.querySelector('.setting-item .setting-value');
        if (tempValueDisplay) tempValueDisplay.textContent = state.userSettings.ai.temperature.toFixed(1);

        document.getElementById("maxTokens").value = state.userSettings.ai.maxTokens;
        document.getElementById("aiPersonality").value = state.userSettings.ai.personality;
        document.getElementById("theme").value = state.userSettings.interface.theme;
        document.getElementById("compactMode").checked = state.userSettings.interface.compactMode;
        document.getElementById("enterToSend").checked = state.userSettings.chat.enterToSend;
        document.getElementById("soundNotifications").checked = state.userSettings.interface.soundNotifications;
    }

    function applySettings() {
        applyTheme();
        document.body.classList.toggle("compact-mode", state.userSettings.interface.compactMode);
    }

    function switchTab(tabName) {
        DOM.loginTabs.forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        document.querySelectorAll('.login-form').forEach(form => form.classList.remove('active'));
        document.getElementById(`${tabName}-form`)?.classList.add('active');
    }

    async function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');
            localStorage.setItem('token', data.token);
            showChatInterface(data.user);
        } catch (error) {
            console.error("Erro no login:", error);
            alert(error.message);
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (password !== confirm) return alert('As senhas não coincidem');

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.errors) throw new Error(data.errors[0].msg);
                throw new Error(data.error || 'Erro ao registrar.');
            }
            alert('Conta criada com sucesso! Faça login.');
            switchTab('login');
        } catch (error) {
            console.error("Erro no registro:", error);
            alert(error.message);
        }
    }

    function handleLogout() {
        localStorage.removeItem('token');
        state.currentUser = null;
        state.currentConversationId = null;
        showLoginInterface();
        console.log("Usuário deslogado.");
    }
    
    async function handleNewConversationClick() {
        await criarNovaConversa();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const message = DOM.messageInput.value.trim();
        if (message) {
            state.lastUserMessage = message;
            if (!state.currentConversationId) {
                const newConvId = await criarNovaConversa();
                if (newConvId) await sendMessage(message);
            } else {
                await sendMessage(message);
            }
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && state.userSettings.chat.enterToSend) {
            e.preventDefault();
            DOM.messageForm.requestSubmit();
        }
    }

    function handleStopGeneration() {
        if (state.abortController) {
            state.abortController.abort();
            console.log("Geração cancelada.");
        }
    }

    function handleMessageActions(e) {
        const button = e.target.closest('.action-btn, .copy-code-btn');
        if (!button) return;

        const action = button.dataset.action;
        const messageBubble = button.closest('.message-bubble');
        if (!messageBubble) return;

        const messageText = messageBubble.querySelector('.message-text')?.innerText;
        
        switch (action) {
            case 'copy':
                navigator.clipboard.writeText(messageText).then(() => {
                    button.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => button.innerHTML = '<i class="fas fa-copy"></i>', 2000);
                });
                break;
            case 'copy-code':
                const codeBlock = button.closest('pre').querySelector('code');
                navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                    button.innerHTML = '<i class="fas fa-check"></i> Copiado!';
                    setTimeout(() => button.innerHTML = '<i class="fas fa-copy"></i> Copiar', 2000);
                });
                break;
            case 'regenerate':
                if (state.lastUserMessage) sendMessage(state.lastUserMessage);
                break;
            case 'like':
            case 'dislike':
                button.style.color = 'var(--accent-color)';
                console.log(`Feedback: ${action}`);
                break;
        }
    }

    async function handleHistoryActions(e) {
        const historyItem = e.target.closest('.chat-history-item');
        if (!historyItem) return;

        const button = e.target.closest('.history-action-btn');
        const conversationId = historyItem.dataset.id;

        if (button) {
            e.stopPropagation();
            const action = button.dataset.action;
            if (action === 'delete') {
                if (confirm('Tem certeza?')) await deleteConversation(conversationId);
            } else if (action === 'rename') {
                await renameConversation(conversationId);
            }
        } else {
            await carregarConversa(conversationId);
        }
    }

    async function sendMessage(message) {
        if (!state.currentConversationId) return;
        DOM.chatMessages.querySelector('.welcome-placeholder')?.remove();
        addMessageToChat('user', message);
        DOM.messageInput.value = '';
        autoResizeTextarea.call(DOM.messageInput);
        showThinking();
        state.abortController = new AbortController();

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ message, conversationId: state.currentConversationId, settings: state.userSettings.ai }),
                signal: state.abortController.signal
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Erro do servidor');
            const data = await response.json();
            addMessageToChat('ai', data.response, true);
            if (state.userSettings.interface.soundNotifications) playNotificationSound();
            if (data.isFirstMessage) await carregarHistorico();
        } catch (error) {
            if (error.name !== 'AbortError') {
                addMessageToChat('ai', `Desculpe, ocorreu um erro: ${error.message}`);
            } else {
                addMessageToChat('ai', 'Geração de resposta cancelada.');
            }
        } finally {
            hideThinking();
            state.abortController = null;
        }
    }

    async function criarNovaConversa() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/new-conversation', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao criar conversa');
            const conversation = await response.json();
            state.currentConversationId = conversation.id;
            limparInterface();
            await carregarHistorico();
            DOM.messageInput.focus();
            if (window.innerWidth <= 1024) closeSidebar();
            return conversation.id;
        } catch (error) {
            alert(error.message);
            return null;
        }
    }

    async function carregarHistorico() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const response = await fetch('/api/history', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Falha ao carregar histórico');
            state.chatHistory = await response.json();
            renderizarHistorico();
        } catch (error) {
            console.error(error);
        }
    }

    async function carregarConversa(id) {
        limparInterface();
        state.currentConversationId = id;
        document.querySelectorAll('.chat-history-item.active').forEach(i => i.classList.remove('active'));
        const activeItem = document.querySelector(`.chat-history-item[data-id="${id}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            DOM.chatTitle.textContent = activeItem.querySelector('.chat-title-text').textContent;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/conversation/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Não foi possível carregar a conversa.');
            
            const data = await response.json();

            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(msg => addMessageToChat(msg.role, msg.content, msg.role === 'assistant'));
                state.lastUserMessage = data.messages.filter(m => m.role === 'user').pop()?.content;
            } else {
                adicionarMensagemDeBoasVindas();
            }
            if (window.innerWidth <= 1024) closeSidebar();
        } catch(err) {
            alert(err.message);
            state.currentConversationId = null;
            limparInterface();
        }
    }

    async function deleteConversation(id) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/conversation/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Falha ao excluir.');
            if (id === state.currentConversationId) {
                state.currentConversationId = null;
                limparInterface();
            }
            await carregarHistorico();
        } catch (error) {
            alert(error.message);
        }
    }
    
    async function renameConversation(id) {
        const item = document.querySelector(`.chat-history-item[data-id="${id}"] .chat-title-text`);
        const oldTitle = item.textContent;
        const newTitle = prompt("Novo título:", oldTitle);

        if (newTitle && newTitle.trim() !== '' && newTitle !== oldTitle) {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/conversation/${id}/title`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ title: newTitle })
                });
                if (!res.ok) throw new Error('Falha ao renomear.');
                item.textContent = newTitle;
                item.title = newTitle;
                if (id === state.currentConversationId) DOM.chatTitle.textContent = newTitle;
            } catch (error) {
                alert(error.message);
            }
        }
    }

    function showChatInterface(user) {
        state.currentUser = user;
        DOM.loginScreen.style.display = 'none';
        DOM.appContainer.style.display = 'flex';
        DOM.userNameEl.textContent = user.name || 'Usuário';
        if (DOM.userInitialEl && user.name) DOM.userInitialEl.textContent = user.name.charAt(0).toUpperCase();
        carregarHistorico();
        if (!state.currentConversationId) adicionarMensagemDeBoasVindas();
    }
    
    function showLoginInterface() {
        DOM.loginScreen.style.display = 'flex';
        DOM.appContainer.style.display = 'none';
    }

    function addMessageToChat(role, text, isAi = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', role);
        const avatar = `<div class="message-avatar"><div class="avatar-circle">${isAi ? '<img src="assets/logo.png" alt="SABER">' : (state.currentUser?.name?.charAt(0).toUpperCase() || 'U')}</div></div>`;
        const messageText = isAi ? marked.parse(text) : text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const actions = isAi ? `
            <div class="message-actions">
                <button class="action-btn" data-action="copy" title="Copiar"><i class="fas fa-copy"></i></button>
                <button class="action-btn" data-action="regenerate" title="Gerar Novamente"><i class="fas fa-sync-alt"></i></button>
                <button class="action-btn" data-action="like" title="Gostei"><i class="fas fa-thumbs-up"></i></button>
                <button class="action-btn" data-action="dislike" title="Não Gostei"><i class="fas fa-thumbs-down"></i></button>
            </div>` : '';
        messageWrapper.innerHTML = `${avatar}<div class="message-bubble"><div class="message-text">${messageText}</div>${actions}</div>`;
        DOM.chatMessages.appendChild(messageWrapper);
        messageWrapper.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
        messageWrapper.querySelectorAll('pre').forEach(pre => {
            if (pre.querySelector('code')) {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-code-btn';
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copiar';
                copyBtn.dataset.action = 'copy-code';
                pre.appendChild(copyBtn);
            }
        });
        scrollToBottom(true);
    }
    
    function renderizarHistorico() {
        limparHistoricoVisual();
        preencherSecao('todayChats', state.chatHistory.today);
        preencherSecao('yesterdayChats', state.chatHistory.yesterday);
        preencherSecao('weekChats', state.chatHistory.week);
        preencherSecao('olderChats', state.chatHistory.older);
        const activeItem = document.querySelector(`.chat-history-item[data-id="${state.currentConversationId}"]`);
        if(activeItem) activeItem.classList.add('active');
    }

    function limparHistoricoVisual() {
        ['todaySection', 'yesterdaySection', 'weekSection', 'olderSection'].forEach(id => {
            const section = document.getElementById(id);
            if(section) {
                const list = section.querySelector('.chat-history-list');
                list.innerHTML = '';
                section.style.display = 'none';
            }
        });
    }

    function preencherSecao(containerId, conversas) {
        const container = document.getElementById(containerId);
        const section = document.getElementById(containerId.replace('Chats', 'Section'));
        if (!container || !section || !conversas || !conversas.length) return;
        section.style.display = 'block';
        conversas.forEach(conv => {
            const item = document.createElement('div');
            item.className = 'chat-history-item';
            item.dataset.id = conv.id;
            item.innerHTML = `
                <span class="chat-title-text" title="${conv.title || ''}">${conv.title || 'Nova Conversa'}</span>
                <div class="chat-history-actions">
                    <button class="history-action-btn" data-action="rename" title="Renomear"><i class="fas fa-pen"></i></button>
                    <button class="history-action-btn" data-action="delete" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>`;
            container.appendChild(item);
        });
    }

    function limparInterface() {
        DOM.chatMessages.innerHTML = '';
        hideThinking();
        DOM.messageInput.value = '';
        DOM.messageInput.style.height = 'auto';
        DOM.chatTitle.textContent = 'Sua Conversa';
        document.querySelectorAll('.chat-history-item.active').forEach(item => item.classList.remove('active'));
        if (!state.currentConversationId) adicionarMensagemDeBoasVindas();
    }

    function adicionarMensagemDeBoasVindas() {
        DOM.chatMessages.innerHTML = `
        <div class="welcome-placeholder">
            <img src="assets/logo.png" alt="SABER Logo" class="welcome-logo">
            <h2>Como posso te ajudar hoje?</h2>
            <div class="suggested-prompts">
                <button class="prompt-btn" data-prompt="Explique a teoria da relatividade">Explique a teoria da relatividade</button>
                <button class="prompt-btn" data-prompt="Crie um plano de estudos para biologia">Crie um plano de estudos</button>
                <button class="prompt-btn" data-prompt="Como funciona uma rede neural?">Como funciona uma rede neural?</button>
            </div>
        </div>`;
        document.querySelectorAll('.prompt-btn').forEach(btn => btn.addEventListener('click', () => {
            DOM.messageInput.value = btn.dataset.prompt;
            DOM.messageForm.requestSubmit();
        }));
    }

    function showThinking() {
        DOM.thinkingIndicator.style.display = 'flex';
        DOM.sendButton.disabled = true;
        DOM.messageInput.disabled = true;
    }

    function hideThinking() {
        DOM.thinkingIndicator.style.display = 'none';
        DOM.sendButton.disabled = false;
        DOM.messageInput.disabled = false;
    }
    
    function setupSidebarResponsiveness() {
        if (window.innerWidth > 1024) DOM.sidebar.classList.add('active');
        else DOM.sidebar.classList.remove('active');
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) {
                DOM.sidebar.classList.add('active');
                DOM.sidebarOverlay.classList.remove('active');
            } else {
                DOM.sidebar.classList.remove('active');
            }
        });
    }

    function toggleSidebar() {
        DOM.sidebar.classList.toggle('active');
        DOM.sidebarOverlay.classList.toggle('active');
    }

    function closeSidebar() {
        DOM.sidebar.classList.remove('active');
        DOM.sidebarOverlay.classList.remove('active');
    }

    function toggleTheme() {
        const currentTheme = document.body.dataset.theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        state.userSettings.interface.theme = newTheme; 
        applyTheme(); 
        saveUserSettings(); 
    }

    function applyTheme() {
        let themeToApply = state.userSettings.interface.theme;
        if (themeToApply === 'auto') {
            themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.body.dataset.theme = themeToApply;
        updateThemeIcon(themeToApply);
    }
    
    function updateThemeIcon(theme) {
        const icon = DOM.themeToggleBtn.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    async function exportConversations() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/api/export', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Falha ao exportar.');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const filename = response.headers.get('content-disposition')?.split('filename=')[1] || 'saber_export.json';
            a.download = filename.replace(/"/g, '');
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            alert(error.message);
        }
    }

    async function clearAllHistory() {
        if (confirm('Tem certeza que deseja apagar TODO o seu histórico? Esta ação é irreversível.')) {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch('/api/clear-all', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                if (!response.ok) throw new Error('Falha ao limpar histórico.');
                await carregarHistorico();
                state.currentConversationId = null;
                limparInterface();
                alert('Seu histórico foi apagado.');
                closeSettingsModal();
            } catch (error) {
                alert(error.message);
            }
        }
    }
    
    function playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,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');
            audio.volume = 0.3;
            audio.play().catch(e => console.warn('Som de notificação não pôde ser reproduzido:', e));
        } catch (error) {
            console.warn('Erro ao reproduzir som:', error);
        }
    }

    function autoResizeTextarea() {
        this.style.height = 'auto';
        const maxHeight = 150;
        this.style.height = `${Math.min(this.scrollHeight, maxHeight)}px`;
    }

    function isScrolledToBottom() {
        if (!DOM.chatMessages) return true;
        return DOM.chatMessages.scrollHeight - DOM.chatMessages.clientHeight <= DOM.chatMessages.scrollTop + 50;
    }

    function scrollToBottom(force = false) {
        if (DOM.chatMessages && (force || isScrolledToBottom())) {
            DOM.chatMessages.scrollTo({ top: DOM.chatMessages.scrollHeight, behavior: 'smooth' });
        }
    }

    initializeApp();
});