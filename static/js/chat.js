document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SABER Chat App inicializando...');

    //================================================
    // 1. Seletores de Elementos do DOM
    //================================================
    const loginScreen = document.getElementById('loginScreen');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTabs = document.querySelectorAll('.login-tab');
    const appContainer = document.getElementById('appContainer');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const thinkingIndicator = document.getElementById('thinking');
    const newChatBtn = document.getElementById('newChatBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const headerMenuBtn = document.getElementById('headerMenuBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const settingsModalOverlay = document.getElementById('settingsModalOverlay');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsPanels = document.querySelectorAll('.settings-panel');

    //================================================
    // 2. Estado da Aplicação
    //================================================
    let currentConversationId = null;
    let currentUser = null;
    let chatHistory = {
        today: [],
        yesterday: [],
        week: [],
        older: []
    };
    let userSettings = {
        ai: {
            temperature: 0.5,
            maxTokens: 300,
            personality: 'balanced',
            contextMemory: 10
        },
        interface: {
            theme: 'light',
            fontSize: 'medium',
            typingEffect: true,
            soundNotifications: false,
            compactMode: false
        },
        chat: {
            autoSave: true,
            confirmDelete: true,
            enterToSend: true,
            showTimestamps: false
        }
    };

    //================================================
    // 3. Funções de Interface Principal (UI)
    //================================================

    /**
     * Exibe a interface de chat após um login/verificação bem-sucedido.
     * @param {object} user - O objeto do usuário autenticado.
     */
    const showChatInterface = (user) => {
        currentUser = user;
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';

        const userNameEl = document.querySelector('.user-name');
        if (userNameEl) userNameEl.textContent = user.name || 'Usuário';

        carregarHistorico();
        if (!currentConversationId) {
            adicionarMensagemDeBoasVindas();
        }
    };

    /**
     * Exibe a tela de login.
     */
    const showLoginInterface = () => {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        limparHistoricoVisual();
    };

    /**
     * Exibe uma mensagem de boas-vindas na área de chat quando nenhuma conversa está ativa.
     */
    function adicionarMensagemDeBoasVindas() {
        if (!chatMessages) return;
        chatMessages.innerHTML = `
            <div class="welcome-placeholder">
                <div class="logo-circle">
                    <div class="logo-img"><img src="assets/logo.png" alt="Logo"></div>
                </div>
                <h2>Bem-vindo ao SABER</h2>
                <p>Selecione uma conversa ou inicie uma nova para começar.</p>
            </div>
        `;
    }

    /**
     * Limpa a área de chat e exibe a mensagem de boas-vindas.
     */
    function limparInterface() {
        if (chatMessages) chatMessages.innerHTML = '';
        hideThinking();
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
        document.querySelectorAll('.chat-history-item.active').forEach(item => {
            item.classList.remove('active');
        });

        // Se nenhuma conversa estiver ativa após limpar, mostra a mensagem de boas-vindas
        if (!currentConversationId) {
            adicionarMensagemDeBoasVindas();
        }
    }

    //================================================
    // 4. Lógica de Autenticação e Inicialização
    //================================================

    /**
     * Função principal que inicializa a aplicação.
     */
    async function initializeApp() {
        const token = localStorage.getItem('token');

        if (!token) {
            showLoginInterface();
            setupEventListeners();
            return;
        }

        try {
            const res = await fetch('/api/verify-token', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Token inválido ou expirado');

            const userData = await res.json();
            showChatInterface(userData);

        } catch (err) {
            console.error('Falha na verificação do token:', err);
            localStorage.removeItem('token');
            showLoginInterface();
        }

        setupEventListeners();
        setupSidebar();
        loadUserSettings();
        applySettings();
        updateAboutStats();
    }
    
    // ... (O restante das suas funções como `setupEventListeners`, `handleLogin`, `handleRegister`, `sendMessage`, `carregarHistorico`, etc., viriam aqui)
    // O código abaixo é uma continuação direta e completa.

    //================================================
    // 5. Gerenciamento de Eventos
    //================================================
    function setupEventListeners() {
        // Abas de Login/Registro
        loginTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelector('.login-tab.active')?.classList.remove('active');
                document.querySelector('.login-form.active')?.classList.remove('active');
                tab.classList.add('active');
                document.getElementById(`${tab.dataset.tab}-form`)?.classList.add('active');
            });
        });

        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (registerForm) registerForm.addEventListener('submit', handleRegister);
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        
        // Chat
        if (messageForm) messageForm.addEventListener('submit', handleSubmit);
        if (messageInput) {
            messageInput.addEventListener('input', autoResizeTextarea);
            messageInput.addEventListener('keydown', handleKeyDown);
        }
        
        // Sidebar e Modal
        if (newChatBtn) newChatBtn.addEventListener('click', handleNewConversationClick);
        if (headerMenuBtn) headerMenuBtn.addEventListener('click', toggleSidebar);
        if (sidebarToggle) sidebarToggle.addEventListener('click', openSettingsModal);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
        
        setupSettingsModal();
    }
    
    // ... (Handlers de eventos como handleLogin, handleRegister, etc.)
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

        if (password !== confirm) {
            return alert('As senhas não coincidem');
        }

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            if (res.status !== 201) throw new Error(data.error || 'Erro ao registrar');
            
            alert('Conta criada com sucesso! Faça login.');
            document.querySelector('[data-tab="login"]')?.click();
        } catch (error) {
            console.error("Erro no registro:", error);
            alert(error.message);
        }
    }

    function handleLogout() {
        localStorage.removeItem('token');
        currentUser = null;
        currentConversationId = null;
        showLoginInterface();
        console.log("Usuário deslogado.");
    }

    async function handleNewConversationClick() {
        await criarNovaConversa();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (message) {
            // Se não houver conversa ativa, crie uma primeiro
            if (!currentConversationId) {
                const newConvId = await criarNovaConversa();
                if (newConvId) {
                    await sendMessage(message);
                }
            } else {
                await sendMessage(message);
            }
        }
    }
    
    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && userSettings.chat.enterToSend) {
            e.preventDefault();
            messageForm.requestSubmit();
        }
    }

    // O restante das suas funções (sendMessage, carregarHistorico, etc.) permanece praticamente o mesmo.
    // Apenas certifique-se de que a lógica da `welcomeScreen` foi removida.
    // ...

    // Coloque o restante do seu código aqui, a partir da função `setupSettingsModal`.
    // Colei uma versão limpa abaixo para garantir.

    //================================================
    // Lógica do Chat e API
    //================================================
    
    async function sendMessage(message) {
        if (!currentConversationId) {
            console.error("Tentativa de enviar mensagem sem uma conversa ativa.");
            return;
        }

        // Limpa a mensagem de boas-vindas se for a primeira mensagem
        const placeholder = chatMessages.querySelector('.welcome-placeholder');
        if (placeholder) placeholder.remove();

        addMessageToChat('user', message);
        messageInput.value = '';
        autoResizeTextarea.call(messageInput);
        showThinking();

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message,
                    conversationId: currentConversationId,
                    settings: userSettings.ai
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Erro ${response.status}`);
            }

            const data = await response.json();
            hideThinking();
            addMessageToChat('ai', data.response, true);
            if (userSettings.interface.soundNotifications) playNotificationSound();

            if (data.isFirstMessage) {
                await carregarHistorico(); // Atualiza a sidebar com o novo título
            }

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            hideThinking();
            addMessageToChat('ai', `Desculpe, ocorreu um erro: ${error.message}`);
        }
    }

    async function criarNovaConversa() {
        console.log('🆕 Criando nova conversa...');
        showThinking();
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/new-conversation', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao criar conversa');
            }

            const conversation = await response.json();
            currentConversationId = conversation.id;
            
            limparInterface();
            await carregarHistorico(); // Carrega o histórico para mostrar a nova conversa
            
            messageInput.focus();
            if (window.innerWidth <= 1024) closeSidebar();
            
            return conversation.id;

        } catch (error) {
            console.error('Erro ao criar nova conversa:', error);
            alert(error.message);
            return null;
        } finally {
            hideThinking();
        }
    }

    // ... (Aqui entrariam as outras funções como carregarHistorico, deletarConversa, etc.)
    // Adicionei elas abaixo para manter a completude, com pequenas melhorias.

    async function carregarHistorico() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch('/api/history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao carregar histórico');

            chatHistory = await response.json();
            renderizarHistorico();
            updateAboutStats();
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        }
    }
    
    function renderizarHistorico() {
        limparHistoricoVisual();
        preencherSecao('todayChats', chatHistory.today);
        preencherSecao('yesterdayChats', chatHistory.yesterday);
        preencherSecao('weekChats', chatHistory.week);
        preencherSecao('olderChats', chatHistory.older);
        
        // Ativa o item da conversa atual na lista
        const activeItem = document.querySelector(`.chat-history-item[data-id="${currentConversationId}"]`);
        if (activeItem) activeItem.classList.add('active');
    }

    function limparHistoricoVisual() {
        ['todayChats', 'yesterdayChats', 'weekChats', 'olderChats'].forEach(id => {
            const container = document.getElementById(id);
            if (container) container.innerHTML = '';
            document.getElementById(id.replace('Chats', 'Section')).style.display = 'none';
        });
    }

    //================================================
    // 6. Gerenciamento do Modal de Configurações
    //================================================

    function setupSettingsModal() {
        if (settingsCloseBtn) {
            settingsCloseBtn.addEventListener('click', closeSettingsModal);
        }
        if (settingsModalOverlay) {
            settingsModalOverlay.addEventListener('click', (e) => {
                if (e.target === settingsModalOverlay) {
                    closeSettingsModal();
                }
            });
        }
        if (settingsTabs) {
            settingsTabs.forEach(tab => {
                tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
            });
        }
        setupSettingsControls();
        const saveSettingsBtn = document.getElementById('saveSettings');
        if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveUserSettings);
        const resetSettingsBtn = document.getElementById('resetSettings');
        if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', resetUserSettings);
        setupSpecialControls();
    }

    function openSettingsModal() {
        if (settingsModalOverlay) {
            settingsModalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            updateSettingsUI();
            updateAboutStats();
        }
    }

    function closeSettingsModal() {
        if (settingsModalOverlay) {
            settingsModalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function switchSettingsTab(tabName) {
        settingsTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
        settingsPanels.forEach(panel => panel.classList.toggle('active', panel.id === `${tabName}-panel`));
    }

    //================================================
    // 7. Lógica de Configurações (Settings)
    //================================================

    function setupSettingsControls() {
        // AI Settings
        const temperatureSlider = document.getElementById('temperature');
        const temperatureValueDisplay = document.querySelector('[for="temperature"]')?.nextElementSibling?.querySelector('.setting-value');
        if (temperatureSlider && temperatureValueDisplay) {
            temperatureSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                userSettings.ai.temperature = value;
                temperatureValueDisplay.textContent = value.toFixed(1);
            });
        }
        document.getElementById('maxTokens')?.addEventListener('change', (e) => { userSettings.ai.maxTokens = parseInt(e.target.value); });
        document.getElementById('aiPersonality')?.addEventListener('change', (e) => { userSettings.ai.personality = e.target.value; });
        document.getElementById('contextMemory')?.addEventListener('change', (e) => { userSettings.ai.contextMemory = parseInt(e.target.value); });

        // Interface Settings
        document.getElementById('theme')?.addEventListener('change', (e) => { userSettings.interface.theme = e.target.value; applyTheme(); });
        document.getElementById('fontSize')?.addEventListener('change', (e) => { userSettings.interface.fontSize = e.target.value; applyFontSize(); });
        document.getElementById('typingEffect')?.addEventListener('change', (e) => { userSettings.interface.typingEffect = e.target.checked; });
        document.getElementById('soundNotifications')?.addEventListener('change', (e) => { userSettings.interface.soundNotifications = e.target.checked; });
        document.getElementById('compactMode')?.addEventListener('change', (e) => { userSettings.interface.compactMode = e.target.checked; applyCompactMode(); });
        
        // Chat Settings
        document.getElementById('autoSave')?.addEventListener('change', (e) => { userSettings.chat.autoSave = e.target.checked; });
        document.getElementById('confirmDelete')?.addEventListener('change', (e) => { userSettings.chat.confirmDelete = e.target.checked; });
        document.getElementById('enterToSend')?.addEventListener('change', (e) => { userSettings.chat.enterToSend = e.target.checked; });
        document.getElementById('showTimestamps')?.addEventListener('change', (e) => { userSettings.chat.showTimestamps = e.target.checked; applyTimestampDisplay(); });
    }

    function setupSpecialControls() {
        document.getElementById('exportChats')?.addEventListener('click', exportConversations);
        document.getElementById('clearHistory')?.addEventListener('click', clearAllHistory);
    }

    function loadUserSettings() {
        try {
            const savedSettings = localStorage.getItem('saber_settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // Merge profundo para evitar que configurações futuras ausentes no localStorage quebrem o app
                userSettings.ai = { ...userSettings.ai, ...parsed.ai };
                userSettings.interface = { ...userSettings.interface, ...parsed.interface };
                userSettings.chat = { ...userSettings.chat, ...parsed.chat };
            }
        } catch (error) {
            console.warn('Erro ao carregar configurações:', error);
        }
    }

    function saveUserSettings() {
        try {
            localStorage.setItem('saber_settings', JSON.stringify(userSettings));
            applySettings();
            
            const saveBtn = document.getElementById('saveSettings');
            if (saveBtn) {
                const originalText = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
                saveBtn.disabled = true;
                saveBtn.style.background = 'hsl(120, 60%, 50%)';

                setTimeout(() => {
                    saveBtn.innerHTML = originalText;
                    saveBtn.style.background = '';
                    saveBtn.disabled = false;
                }, 2000);
            }
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            alert('Erro ao salvar configurações.');
        }
    }

    function resetUserSettings() {
        if (!confirm('Tem certeza que deseja restaurar as configurações padrão?')) return;

        userSettings = {
            ai: { temperature: 0.5, maxTokens: 300, personality: 'balanced', contextMemory: 10 },
            interface: { theme: 'light', fontSize: 'medium', typingEffect: true, soundNotifications: false, compactMode: false },
            chat: { autoSave: true, confirmDelete: true, enterToSend: true, showTimestamps: false }
        };

        updateSettingsUI();
        saveUserSettings();
        alert('Configurações restauradas para o padrão.');
    }
    
    function updateSettingsUI() {
        // AI
        const tempSlider = document.getElementById('temperature');
        if (tempSlider) tempSlider.value = userSettings.ai.temperature;
        const tempValue = document.querySelector('[for="temperature"]')?.nextElementSibling?.querySelector('.setting-value');
        if (tempValue) tempValue.textContent = userSettings.ai.temperature.toFixed(1);
        document.getElementById('maxTokens').value = userSettings.ai.maxTokens;
        document.getElementById('aiPersonality').value = userSettings.ai.personality;
        document.getElementById('contextMemory').value = userSettings.ai.contextMemory;
        
        // Interface
        document.getElementById('theme').value = userSettings.interface.theme;
        document.getElementById('fontSize').value = userSettings.interface.fontSize;
        document.getElementById('typingEffect').checked = userSettings.interface.typingEffect;
        document.getElementById('soundNotifications').checked = userSettings.interface.soundNotifications;
        document.getElementById('compactMode').checked = userSettings.interface.compactMode;
        
        // Chat
        document.getElementById('autoSave').checked = userSettings.chat.autoSave;
        document.getElementById('confirmDelete').checked = userSettings.chat.confirmDelete;
        document.getElementById('enterToSend').checked = userSettings.chat.enterToSend;
        document.getElementById('showTimestamps').checked = userSettings.chat.showTimestamps;
    }

    function applySettings() {
        applyTheme();
        applyFontSize();
        applyCompactMode();
        applyTimestampDisplay();
    }

    function applyTheme() {
        document.body.removeAttribute('data-theme');
        if (userSettings.interface.theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        } else if (userSettings.interface.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.setAttribute('data-theme', 'dark');
        }
    }

    function applyFontSize() {
        document.body.classList.remove('font-small', 'font-medium', 'font-large');
        document.body.classList.add(`font-${userSettings.interface.fontSize}`);
    }

    function applyCompactMode() {
        document.body.classList.toggle('compact-mode', userSettings.interface.compactMode);
    }

    function applyTimestampDisplay() {
        chatMessages.classList.toggle('show-timestamps', userSettings.chat.showTimestamps);
    }

    //================================================
    // 8. Funções de Sidebar e Layout
    //================================================
    
    function setupSidebar() {
        if (window.innerWidth > 1024) {
            sidebar.classList.add('active');
        } else {
            sidebar.classList.remove('active');
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) {
                sidebar.classList.add('active');
                sidebarOverlay.classList.remove('active');
            } else {
                sidebar.classList.remove('active');
            }
        });
    }

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    }
    
    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }

    //================================================
    // 9. Funções Auxiliares e Utilitários
    //================================================

    function autoResizeTextarea() {
        this.style.height = 'auto';
        const maxHeight = 120;
        this.style.height = `${Math.min(this.scrollHeight, maxHeight)}px`;
    }

    function showThinking() {
        if (thinkingIndicator) thinkingIndicator.style.display = 'flex';
        if (sendButton) sendButton.disabled = true;
        if (messageInput) messageInput.disabled = true;
    }

    function hideThinking() {
        if (thinkingIndicator) thinkingIndicator.style.display = 'none';
        if (sendButton) sendButton.disabled = false;
        if (messageInput) messageInput.disabled = false;
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function isScrolledToBottom() {
        if (!chatMessages) return true;
        const scrollThreshold = 50;
        return chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + scrollThreshold;
    }
    
    function scrollToBottom(force = false) {
        if (chatMessages && (force || isScrolledToBottom())) {
            chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        }
    }
    
    initializeApp();
});