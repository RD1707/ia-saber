document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SABER Chat inicializando...');

    const loginScreen = document.getElementById('loginScreen');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTabs = document.querySelectorAll('.login-tab');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const welcomeForm = document.getElementById('welcome-form');
    const appContainer = document.getElementById('appContainer');
    const welcomeInput = document.getElementById('welcome-input');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const thinkingIndicator = document.getElementById('thinking');

    const newChatBtn = document.getElementById('newChatBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const headerMenuBtn = document.getElementById('headerMenuBtn'); 
    const sidebarToggle = document.getElementById('sidebarToggle'); 

    const settingsModalOverlay = document.getElementById('settingsModalOverlay');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsPanels = document.querySelectorAll('.settings-panel');


    let currentConversationId = null;
    let chatHistory = {
        today: [],
        yesterday: [],
        week: [],
        older: []
    };
    let currentUser = null;

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


    if (loginTabs && loginTabs.length > 0) {
        loginTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const activeLoginTab = document.querySelector('.login-tab.active');
                if (activeLoginTab) activeLoginTab.classList.remove('active');

                const activeLoginForm = document.querySelector('.login-form.active');
                if (activeLoginForm) activeLoginForm.classList.remove('active');

                tab.classList.add('active');
                const targetForm = document.getElementById(`${tab.dataset.tab}-form`);
                if (targetForm) targetForm.classList.add('active');
            });
        });
    } else {
        console.warn('Abas de login não encontradas.');
    }


    // Função para mostrar tela de boas-vindas/chat após login/verificação
    const showWelcomeOrChatInterface = (user) => {
        currentUser = user; // Armazena dados do usuário
        if (loginScreen) loginScreen.style.display = 'none';
        if (welcomeScreen) welcomeScreen.style.display = 'flex'; // Sempre mostra welcome screen primeiro
        if (appContainer) appContainer.style.display = 'none'; // Garante que o chat não apareça ainda

        const userNameEl = document.querySelector('.user-name');
        const userPlanEl = document.querySelector('.user-plan');
        if (userNameEl) userNameEl.textContent = user.name || 'Usuário';
        if (userPlanEl) userPlanEl.textContent = 'Versão Gratuita'; // Ou o plano real do usuário

        carregarHistorico(); // Carrega o histórico após saber quem é o usuário
    };

    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            if (!emailInput || !passwordInput) return;

            const email = emailInput.value;
            const password = passwordInput.value;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    showWelcomeOrChatInterface(data.user);
                } else {
                    alert(data.error || 'Erro ao fazer login');
                }
            } catch (error) {
                console.error("Erro no login:", error);
                alert('Erro de conexão com o servidor durante o login.');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('reg-name');
            const emailInput = document.getElementById('reg-email');
            const passwordInput = document.getElementById('reg-password');
            const confirmInput = document.getElementById('reg-confirm');

            if (!nameInput || !emailInput || !passwordInput || !confirmInput) return;

            const name = nameInput.value;
            const email = emailInput.value;
            const password = passwordInput.value;
            const confirm = confirmInput.value;

            if (password !== confirm) {
                alert('As senhas não coincidem');
                return;
            }

            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await res.json();
                if (res.status === 201) {
                    alert('Conta criada com sucesso! Faça login.');
                    const loginTab = document.querySelector('[data-tab="login"]');
                    if (loginTab) loginTab.click();
                } else {
                    alert(data.error || 'Erro ao registrar');
                }
            } catch (error) {
                console.error("Erro no registro:", error);
                alert('Erro de conexão com o servidor durante o registro.');
            }
        });
    }


    async function initializeApp() {
        const token = localStorage.getItem('token');

        if (!token) {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'none';
            setupEventListeners(); // Configura listeners mesmo sem token (para login/registro)
            return;
        }

        try {
            const res = await fetch('/api/verify-token', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error('Token inválido ou expirado:', errorData.error || res.status);
                throw new Error('Token inválido');
            }

            const userData = await res.json();
            showWelcomeOrChatInterface(userData); 

        } catch (err) {
            console.error('Falha na verificação do token:', err);
            localStorage.removeItem('token');
            if (loginScreen) loginScreen.style.display = 'flex';
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'none';
        }

        setupEventListeners();
        setupSidebar();
        loadUserSettings();
        applySettings();
        updateAboutStats();
    }

    function setupEventListeners() {
        if (welcomeForm) {
            welcomeForm.addEventListener('submit', handleWelcomeSubmit);
        }
        if (messageForm) {
            messageForm.addEventListener('submit', handleSubmit);
        }

        if (messageInput) {
            messageInput.addEventListener('input', autoResizeTextarea);
            messageInput.addEventListener('keydown', handleKeyDown);
        }

        if (newChatBtn) {
            newChatBtn.addEventListener('click', async () => { 
                await criarNovaConversa();
                if (currentConversationId) {
                    if (welcomeScreen) welcomeScreen.style.display = 'none';
                    if (appContainer) appContainer.style.display = 'flex';
                }
            });
        }

        if (headerMenuBtn) { // Para mobile
            headerMenuBtn.addEventListener('click', toggleSidebar);
        }
        if (sidebarToggle) { // Botão de configurações na sidebar
            sidebarToggle.addEventListener('click', openSettingsModal);
        }
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', closeSidebar);
        }

        setupSettingsModal();
    }

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

        if (settingsTabs && settingsTabs.length > 0 && settingsPanels && settingsPanels.length > 0) {
            settingsTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    switchSettingsTab(tab.dataset.tab);
                });
            });
        } else {
            console.warn("Elementos do modal de configurações (abas ou painéis) não encontrados.");
        }


        setupSettingsControls();

        const saveSettingsBtn = document.getElementById('saveSettings');
        const resetSettingsBtn = document.getElementById('resetSettings');

        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', saveUserSettings);
        }

        if (resetSettingsBtn) {
            resetSettingsBtn.addEventListener('click', resetUserSettings);
        }

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
        if (!settingsTabs || !settingsPanels) return;
        settingsTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        settingsPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}-panel`);
        });
    }

    function setupSettingsControls() {
        const temperatureSlider = document.getElementById('temperature');
        const temperatureValueDisplay = document.querySelector('[for="temperature"]')?.nextElementSibling?.querySelector('.setting-value');

        if (temperatureSlider && temperatureValueDisplay) {
            temperatureSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                userSettings.ai.temperature = value;
                temperatureValueDisplay.textContent = value.toFixed(1);
            });
        }

        const maxTokensSelect = document.getElementById('maxTokens');
        if (maxTokensSelect) {
            maxTokensSelect.addEventListener('change', (e) => {
                userSettings.ai.maxTokens = parseInt(e.target.value);
            });
        }

        const personalitySelect = document.getElementById('aiPersonality');
        if (personalitySelect) {
            personalitySelect.addEventListener('change', (e) => {
                userSettings.ai.personality = e.target.value;
            });
        }

        const contextMemorySelect = document.getElementById('contextMemory'); //Presumi que o ID é 'contextMemory'
        if (contextMemorySelect) {
            contextMemorySelect.addEventListener('change', (e) => {
                // Presumi que o nome da configuração é userSettings.ai.contextMemory ou userSettings.chat.contextMemory
                // Vou usar userSettings.ai.contextMemory conforme o objeto userSettings original
                userSettings.ai.contextMemory = parseInt(e.target.value);
            });
        }


        const themeSelect = document.getElementById('theme');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                userSettings.interface.theme = e.target.value;
                applyTheme();
            });
        }

        const fontSizeSelect = document.getElementById('fontSize');
        if (fontSizeSelect) {
            fontSizeSelect.addEventListener('change', (e) => {
                userSettings.interface.fontSize = e.target.value;
                applyFontSize();
            });
        }

        const typingEffectToggle = document.getElementById('typingEffect');
        if (typingEffectToggle) {
            typingEffectToggle.addEventListener('change', (e) => {
                userSettings.interface.typingEffect = e.target.checked;
            });
        }

        const soundNotificationsToggle = document.getElementById('soundNotifications');
        if (soundNotificationsToggle) {
            soundNotificationsToggle.addEventListener('change', (e) => {
                userSettings.interface.soundNotifications = e.target.checked;
            });
        }

        const compactModeToggle = document.getElementById('compactMode');
        if (compactModeToggle) {
            compactModeToggle.addEventListener('change', (e) => {
                userSettings.interface.compactMode = e.target.checked;
                applyCompactMode();
            });
        }

        const autoSaveToggle = document.getElementById('autoSave');
        if (autoSaveToggle) {
            autoSaveToggle.addEventListener('change', (e) => {
                userSettings.chat.autoSave = e.target.checked;
            });
        }

        const confirmDeleteToggle = document.getElementById('confirmDelete');
        if (confirmDeleteToggle) {
            confirmDeleteToggle.addEventListener('change', (e) => {
                userSettings.chat.confirmDelete = e.target.checked;
            });
        }

        const enterToSendToggle = document.getElementById('enterToSend');
        if (enterToSendToggle) {
            enterToSendToggle.addEventListener('change', (e) => {
                userSettings.chat.enterToSend = e.target.checked;
            });
        }

        const showTimestampsToggle = document.getElementById('showTimestamps');
        if (showTimestampsToggle) {
            showTimestampsToggle.addEventListener('change', (e) => {
                userSettings.chat.showTimestamps = e.target.checked;
                applyTimestampDisplay();
            });
        }
    }

    function setupSpecialControls() {
        const exportChatsBtn = document.getElementById('exportChats');
        if (exportChatsBtn) {
            exportChatsBtn.addEventListener('click', exportConversations);
        }

        const clearHistoryBtn = document.getElementById('clearHistory');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', clearAllHistory);
        }
    }

    function loadUserSettings() {
        try {
            const savedSettings = localStorage.getItem('saber_settings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                // Merge de forma inteligente para não sobrescrever toda a estrutura se chaves faltarem
                userSettings.ai = { ...userSettings.ai, ...parsedSettings.ai };
                userSettings.interface = { ...userSettings.interface, ...parsedSettings.interface };
                userSettings.chat = { ...userSettings.chat, ...parsedSettings.chat };
                console.log('Configurações carregadas:', userSettings);
            }
        } catch (error) {
            console.warn('Erro ao carregar configurações:', error);
            // Mantém as configurações padrão se houver erro
        }
    }


    function saveUserSettings() {
        try {
            localStorage.setItem('saber_settings', JSON.stringify(userSettings));
            console.log('Configurações salvas');

            applySettings(); // Re-aplica para garantir consistência

            const saveBtn = document.getElementById('saveSettings');
            if (saveBtn) {
                const originalText = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
                saveBtn.disabled = true; // Desabilita temporariamente
                saveBtn.style.background = 'hsl(120, 60%, 50%)'; // Verde sucesso

                setTimeout(() => {
                    saveBtn.innerHTML = originalText;
                    saveBtn.style.background = ''; // Volta ao normal
                    saveBtn.disabled = false;
                }, 2000);
            }

        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            alert('Erro ao salvar configurações. Tente novamente.');
        }
    }

    function resetUserSettings() {
        if (!confirm('Tem certeza que deseja restaurar todas as configurações padrão? Esta ação não pode ser desfeita.')) {
            return;
        }

        // Redefine para os valores padrão
        userSettings = {
            ai: { temperature: 0.5, maxTokens: 300, personality: 'balanced', contextMemory: 10 },
            interface: { theme: 'light', fontSize: 'medium', typingEffect: true, soundNotifications: false, compactMode: false },
            chat: { autoSave: true, confirmDelete: true, enterToSend: true, showTimestamps: false }
        };

        updateSettingsUI(); // Atualiza a UI para refletir os padrões
        applySettings();    // Aplica visualmente os padrões
        saveUserSettings(); // Salva os padrões no localStorage

        console.log('🔄 Configurações resetadas para o padrão.');
        alert('Configurações restauradas para o padrão.');
    }


    function updateSettingsUI() {
        const temperatureSlider = document.getElementById('temperature');
        const temperatureValueDisplay = document.querySelector('[for="temperature"]')?.nextElementSibling?.querySelector('.setting-value');
        if (temperatureSlider && temperatureValueDisplay) {
            temperatureSlider.value = userSettings.ai.temperature;
            temperatureValueDisplay.textContent = userSettings.ai.temperature.toFixed(1);
        }

        const maxTokensSelect = document.getElementById('maxTokens');
        if (maxTokensSelect) maxTokensSelect.value = userSettings.ai.maxTokens;

        const personalitySelect = document.getElementById('aiPersonality');
        if (personalitySelect) personalitySelect.value = userSettings.ai.personality;

        const contextMemorySelect = document.getElementById('contextMemory');
        if (contextMemorySelect) contextMemorySelect.value = userSettings.ai.contextMemory; // Corrigido para userSettings.ai


        const themeSelect = document.getElementById('theme');
        if (themeSelect) themeSelect.value = userSettings.interface.theme;

        const fontSizeSelect = document.getElementById('fontSize');
        if (fontSizeSelect) fontSizeSelect.value = userSettings.interface.fontSize;

        const toggles = [
            ['typingEffect', userSettings.interface.typingEffect],
            ['soundNotifications', userSettings.interface.soundNotifications],
            ['compactMode', userSettings.interface.compactMode],
            ['autoSave', userSettings.chat.autoSave],
            ['confirmDelete', userSettings.chat.confirmDelete],
            ['enterToSend', userSettings.chat.enterToSend],
            ['showTimestamps', userSettings.chat.showTimestamps]
        ];

        toggles.forEach(([id, value]) => {
            const toggle = document.getElementById(id);
            if (toggle) {
                toggle.checked = value;
            }
        });
    }

    function applySettings() {
        applyTheme();
        applyFontSize();
        applyCompactMode();
        applyTimestampDisplay();
    }

    function applyTheme() {
        const theme = userSettings.interface.theme;
        document.body.removeAttribute('data-theme'); // Limpa tema anterior

        if (theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        } else if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.body.setAttribute('data-theme', 'dark');
            }
            // Se for 'light' ou 'auto' e o sistema for light, nenhum atributo é necessário (usa o padrão CSS)
        }
    }


    function applyFontSize() {
        const fontSize = userSettings.interface.fontSize;
        document.body.classList.remove('font-small', 'font-medium', 'font-large'); // Limpa classes de tamanho anteriores
        if (fontSize === 'small' || fontSize === 'medium' || fontSize === 'large') {
            document.body.classList.add(`font-${fontSize}`);
        } else {
            document.body.classList.add('font-medium'); // Padrão
        }
    }


    function applyCompactMode() {
        const compact = userSettings.interface.compactMode;
        document.body.classList.toggle('compact-mode', compact);
    }

    function applyTimestampDisplay() {
        const showTimestamps = userSettings.chat.showTimestamps;
        document.body.classList.toggle('show-timestamps', showTimestamps); 
        if (chatMessages) {
            const messageTimes = chatMessages.querySelectorAll('.message-time');
            messageTimes.forEach(timeEl => {
                timeEl.style.display = showTimestamps ? 'block' : 'none';
            });
        }
    }


    async function exportConversations() {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            alert("Autenticação necessária para exportar.");
            return;
        }
        try {
            const response = await fetch('/api/export', { 
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro ao buscar conversas para exportar (${response.status})`);
            }

            const exportData = await response.json(); 

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `saber_export_${currentUser?.id || 'user'}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('Conversas exportadas');
            alert('Conversas exportadas com sucesso!');

        } catch (error) {
            console.error('Erro ao exportar conversas:', error);
            alert(`Erro ao exportar conversas: ${error.message}.`);
        }
    }


    async function clearAllHistory() {
        const message = userSettings.chat.confirmDelete ?
            'Tem certeza que deseja deletar TODAS as suas conversas? Esta ação não pode ser desfeita.' :
            'Deletar todas as suas conversas?';

        if (!confirm(message)) {
            return;
        }

        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            alert("Autenticação necessária para limpar o histórico.");
            return;
        }

        try {
            const response = await fetch('/api/clear-all', { 
                method: 'DELETE', 
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro ao limpar histórico (${response.status})`);
            }

            limparInterface();
            currentConversationId = null;

            if (welcomeScreen) welcomeScreen.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';

            await carregarHistorico(); 

            console.log('Histórico limpo');
            alert('Todas as suas conversas foram deletadas.');

        } catch (error) {
            console.error('Erro ao limpar histórico:', error);
            alert(`Erro ao limpar histórico: ${error.message}`);
        }
    }


    function updateAboutStats() {
        const totalConversations = (chatHistory.today?.length || 0) +
            (chatHistory.yesterday?.length || 0) +
            (chatHistory.week?.length || 0) +
            (chatHistory.older?.length || 0);

        let totalMessages = 0;
        [chatHistory.today, chatHistory.yesterday, chatHistory.week, chatHistory.older].forEach(section => {
            if (section) {
                totalMessages += section.reduce((sum, conv) => sum + (conv.message_count || 0), 0);
            }
        });

        let daysUsing = 0;
        const allLocalConversations = [
            ...(chatHistory.today || []),
            ...(chatHistory.yesterday || []),
            ...(chatHistory.week || []),
            ...(chatHistory.older || [])
        ];

        if (allLocalConversations.length > 0) {
            const oldestConvDate = allLocalConversations.reduce((oldestDate, conv) => {
                const convDate = new Date(conv.created_at);
                return convDate < oldestDate ? convDate : oldestDate;
            }, new Date(allLocalConversations[0].created_at));
            
            const now = new Date();
            daysUsing = Math.max(1, Math.ceil((now - oldestConvDate) / (1000 * 60 * 60 * 24)));
        }
        
        // IDs do HTML do modal "Sobre"
        const totalConversationsEl = document.querySelector('#about-panel .stat-item:nth-child(1) .stat-number');
        const totalMessagesEl = document.querySelector('#about-panel .stat-item:nth-child(2) .stat-number');
        const daysUsingEl = document.querySelector('#about-panel .stat-item:nth-child(3) .stat-number');


        if (totalConversationsEl) totalConversationsEl.textContent = totalConversations;
        if (totalMessagesEl) totalMessagesEl.textContent = totalMessages;
        if (daysUsingEl) daysUsingEl.textContent = daysUsing;
    }


    function setupSidebar() {
        if (window.innerWidth > 1024 && sidebar) { 
            sidebar.classList.remove('hidden'); 
            sidebar.classList.add('active');    
        } else if (sidebar) {
            sidebar.classList.remove('active'); 
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024 && sidebar) {
                sidebar.classList.add('active'); 
                if (sidebarOverlay) sidebarOverlay.classList.remove('active'); 
            } else if (sidebar) {
                sidebar.classList.remove('active'); 
            }
        });
    }


    function toggleSidebar() {
        if (!sidebar || !sidebarOverlay) return;
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    }

    function openSidebar() {
        if (sidebar) sidebar.classList.add('active');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }

    async function handleWelcomeSubmit(e) {
        e.preventDefault();
        if (!welcomeInput) return;

        const firstMessage = welcomeInput.value.trim();
        if (!firstMessage) return;

        console.log('💭 Primeira mensagem da Welcome Screen:', firstMessage);

        if (welcomeScreen) welcomeScreen.classList.add('fade-out');

        welcomeInput.disabled = true;
        const welcomeSubmitBtn = document.getElementById('welcome-submit');
        if (welcomeSubmitBtn) welcomeSubmitBtn.disabled = true;

        try {
            const newConversationId = await criarNovaConversa(); 

            if (newConversationId) { 
                await sendMessage(firstMessage); 

                if (welcomeScreen) welcomeScreen.style.display = 'none';
                if (appContainer) appContainer.style.display = 'flex';
                if (welcomeInput) welcomeInput.value = ''; 
            } else {
                console.error("Não foi possível criar uma nova conversa (handleWelcomeSubmit). Mantendo na Welcome Screen.");
                if (welcomeScreen) welcomeScreen.classList.remove('fade-out'); 
            }
        } catch (error) {
            console.error("Erro crítico no fluxo de handleWelcomeSubmit:", error);
            alert("Ocorreu um erro inesperado ao iniciar o chat. Tente novamente.");
            if (welcomeScreen) welcomeScreen.classList.remove('fade-out');
        } finally {
            if (welcomeInput) welcomeInput.disabled = false;
            if (welcomeSubmitBtn) welcomeSubmitBtn.disabled = false;
        }
    }


    async function sendMessage(message) {
        if (!message.trim()) return;
        if (!currentConversationId) {
            alert("Nenhuma conversa ativa. Por favor, inicie uma nova conversa.");
            console.error("sendMessage chamada sem currentConversationId");
            return;
        }

        console.log(`📤 Enviando mensagem para ${currentConversationId}:`, message.substring(0, 50) + '...');
        addMessageToChat('user', message); 

        if (messageInput && messageInput.value === message) { 
            messageInput.value = '';
            messageInput.style.height = 'auto'; 
        }
        showThinking();

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert("Sessão expirada. Por favor, faça login novamente.");
                localStorage.removeItem('token');
                if(loginScreen) loginScreen.style.display = 'flex';
                if(welcomeScreen) welcomeScreen.style.display = 'none';
                if(appContainer) appContainer.style.display = 'none';
                hideThinking();
                return;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: message,
                    conversationId: currentConversationId,
                    settings: userSettings.ai
                })
            });

            const data = await response.json(); // Tenta parsear JSON mesmo se não for ok, para pegar erro do backend

            if (!response.ok) {
                 if (response.status === 401 || response.status === 403) {
                    alert(`Erro de autenticação (${response.status}): ${data.error || 'Token inválido ou expirado. Faça login novamente.'}`);
                    localStorage.removeItem('token');
                    if(loginScreen) loginScreen.style.display = 'flex';
                    if(welcomeScreen) welcomeScreen.style.display = 'none';
                    if(appContainer) appContainer.style.display = 'none';
                } else {
                    alert(`Erro do servidor ao enviar mensagem (${response.status}): ${data.error || 'Tente novamente.'}`);
                }
                throw new Error(`HTTP error! status: ${response.status}, message: ${data.error}`);
            }
            
            hideThinking();
            addMessageToChat('ai', data.response, userSettings.interface.typingEffect);

            if (userSettings.interface.soundNotifications) {
                playNotificationSound();
            }

            if (data.isFirstMessage || (data.title && document.querySelector(`.chat-history-item.active .chat-item-title`)?.textContent !== data.title)) {
                console.log('Primeira mensagem ou título mudou. Recarregando histórico para refletir o título.');
                await carregarHistorico();
            }

        } catch (error) {
            console.error('Erro ao processar/enviar mensagem:', error.message);
            hideThinking();
            addMessageToChat('ai', 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.');
        }
        scrollToBottom();
    }

    async function handleSubmit(e) { 
        e.preventDefault();
        if (!messageInput) return;
        const message = messageInput.value.trim();
        if (!message) return;
        await sendMessage(message);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && userSettings.chat.enterToSend) {
            e.preventDefault();
            if (messageForm) messageForm.requestSubmit(); 
        }
    }

    async function criarNovaConversa() {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            alert('Erro de autenticação. Por favor, faça login novamente.');
            if(loginScreen) loginScreen.style.display = 'flex';
            if(welcomeScreen) welcomeScreen.style.display = 'none';
            if(appContainer) appContainer.style.display = 'none';
            return null; 
        }

        console.log('🆕 Tentando criar nova conversa via API...');
        showThinking(); // Indicador visual
        try {
            const response = await fetch('/api/new-conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                }
            });
            
            const data = await response.json(); // Tenta parsear JSON mesmo se não for ok

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                     alert(`Erro de autenticação (${response.status}): ${data.error || 'Token inválido ou expirado. Faça login novamente.'}`);
                    localStorage.removeItem('token');
                    if(loginScreen) loginScreen.style.display = 'flex';
                    if(welcomeScreen) welcomeScreen.style.display = 'none';
                    if(appContainer) appContainer.style.display = 'none';
                } else {
                    alert(`Erro ao criar nova conversa no servidor (${response.status}): ${data.error}`);
                }
                currentConversationId = null; 
                hideThinking();
                return null; 
            }

            if (!data || !data.id) {
                console.error("Resposta da API /api/new-conversation não continha ID válido:", data);
                alert("Erro ao obter dados da nova conversa do servidor.");
                currentConversationId = null;
                hideThinking();
                return null; 
            }

            currentConversationId = data.id;
            console.log('✅ Nova conversa criada com ID:', currentConversationId);
            limparInterface(); 
            await carregarHistorico(); 
            
            if (messageInput) messageInput.focus();
            if (window.innerWidth <= 1024) { 
                closeSidebar();
            }
            hideThinking();
            return data.id; 

        } catch (error) {
            console.error('Falha crítica em criarNovaConversa (catch):', error);
            alert('Falha crítica ao tentar criar nova conversa. Verifique o console.');
            currentConversationId = null;
            hideThinking();
            return null; 
        }
    }


    async function carregarHistorico() {
        const currentToken = localStorage.getItem('token');
        if (!currentToken || !currentUser) { 
            console.log("Usuário não autenticado ou dados do usuário não disponíveis, não carregando histórico.");
            preencherSecao('todayChats', [], 'Hoje');
            preencherSecao('yesterdayChats', [], 'Ontem');
            preencherSecao('weekChats', [], 'Últimos 7 dias');
            preencherSecao('olderChats', [], 'Conversas antigas');
            return;
        }

        console.log('Carregando histórico para o usuário:', currentUser.id);
        try {
            const response = await fetch('/api/history', {
                 headers: { 'Authorization': `Bearer ${currentToken}` }
            });

            const data = await response.json(); // Tenta parsear JSON

            if (!response.ok) {
                console.error(`Erro ao carregar histórico (${response.status}):`, data.error);
                if (response.status === 401 || response.status === 403){
                    localStorage.removeItem('token');
                    // Não mostra alerta aqui para não ser repetitivo se outras chamadas falharem também.
                    // O fluxo de inicialização ou a próxima ação autenticada deve pegar isso.
                }
                 // Limpa o histórico da UI em caso de erro
                preencherSecao('todayChats', [], 'Hoje');
                preencherSecao('yesterdayChats', [], 'Ontem');
                preencherSecao('weekChats', [], 'Últimos 7 dias');
                preencherSecao('olderChats', [], 'Conversas antigas');
                return;
            }

            chatHistory = data; 

            preencherSecao('todayChats', data.today || [], 'Hoje');
            preencherSecao('yesterdayChats', data.yesterday || [], 'Ontem');
            preencherSecao('weekChats', data.week || [], 'Últimos 7 dias');
            preencherSecao('olderChats', data.older || [], 'Conversas antigas');

            // Destaca a conversa ativa na lista, se houver
            if(currentConversationId) {
                const activeItem = document.querySelector(`.chat-history-item[data-id="${currentConversationId}"]`);
                if(activeItem) {
                    document.querySelectorAll('.chat-history-item.active').forEach(item => item.classList.remove('active'));
                    activeItem.classList.add('active');
                }
            }


            console.log('Histórico carregado:', {
                hoje: (data.today || []).length,
                ontem: (data.yesterday || []).length,
                semana: (data.week || []).length,
                antigas: (data.older || []).length
            });
            updateAboutStats(); 

        } catch (error) {
            console.error('Erro crítico ao carregar histórico (catch):', error);
             preencherSecao('todayChats', [], 'Hoje');
            preencherSecao('yesterdayChats', [], 'Ontem');
            preencherSecao('weekChats', [], 'Últimos 7 dias');
            preencherSecao('olderChats', [], 'Conversas antigas');
        }
    }


    function preencherSecao(containerId, conversas, sectionName) {
        const container = document.getElementById(containerId);
        const sectionEl = document.getElementById(containerId.replace('Chats', 'Section'));

        if (!container) {
            console.warn(`Container do histórico "${containerId}" não encontrado.`);
            if(sectionEl) sectionEl.style.display = 'none'; // Esconde a seção se o container não existe
            return;
        }
        container.innerHTML = ''; 

        if (!conversas || conversas.length === 0) {
            if(sectionEl) sectionEl.style.display = 'none'; // Esconde a seção se não há conversas
            return;
        }
        
        if(sectionEl) sectionEl.style.display = ''; // Garante que a seção esteja visível

        conversas.forEach((conv, index) => {
            const chatItem = createChatHistoryItem(conv);
            container.appendChild(chatItem);
            // Animação já está no CSS
        });
    }


    function createChatHistoryItem(conv) {
        const div = document.createElement('div');
        div.className = 'chat-history-item';
        div.dataset.id = conv.id; // Adiciona ID para fácil seleção

        if (conv.id === currentConversationId) {
            div.classList.add('active');
        }
        const title = conv.title || 'Conversa sem título';
        
        // Ícone de mensagem (pode ser customizado depois)
        const iconHtml = '<i class="fas fa-comments"></i>'; 

        div.innerHTML = `
            <div class="chat-item-main">
                <div class="chat-item-icon">${iconHtml}</div>
                <div class="chat-item-content">
                    <div class="chat-item-title">${escapeHtml(title)}</div>
                </div>
            </div>
            <div class="chat-item-actions">
                <button class="chat-action-btn delete" title="Deletar conversa">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        const mainContent = div.querySelector('.chat-item-main');
        const deleteBtn = div.querySelector('.chat-action-btn.delete');

        if (mainContent) {
            mainContent.addEventListener('click', async () => { 
                if (currentConversationId !== conv.id) { // Só carrega se não for a ativa
                    await carregarConversa(conv.id);
                } else { // Se já está ativa, apenas garante que está visível e scrolla
                     if (welcomeScreen) welcomeScreen.style.display = 'none';
                     if (appContainer) appContainer.style.display = 'flex';
                     scrollToBottom(true);
                }
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => { 
                e.stopPropagation(); 
                await deletarConversa(conv.id, div);
            });
        }
        return div;
    }


    async function carregarConversa(conversationIdToLoad) {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            alert("Autenticação necessária para carregar a conversa.");
            return;
        }
        if (!conversationIdToLoad) {
            console.warn("ID da conversa para carregar é inválido.");
            return;
        }

        console.log('Carregando conversa ID:', conversationIdToLoad);
        showThinking(); // Mostra indicador ao carregar
        try {
            const response = await fetch(`/api/conversation/${conversationIdToLoad}`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });

            const data = await response.json(); // Tenta parsear JSON

            if (!response.ok) {
                 if (response.status === 401 || response.status === 403) {
                    alert(`Erro de autenticação (${response.status}): ${data.error || 'Token inválido ou expirado. Faça login novamente.'}`);
                    localStorage.removeItem('token');
                    if(loginScreen) loginScreen.style.display = 'flex';
                    if(welcomeScreen) welcomeScreen.style.display = 'none';
                    if(appContainer) appContainer.style.display = 'none';
                } else {
                    alert(`Erro ao carregar conversa (${response.status}): ${data.error || 'Tente novamente.'}`);
                }
                throw new Error(data.error || `Erro ${response.status} ao carregar conversa`);
            }

            if (!data.messages) { 
                console.error("Dados da conversa inválidos:", data);
                throw new Error("Formato de dados da conversa inesperado.");
            }

            limparInterface(); 
            currentConversationId = conversationIdToLoad; 

            data.messages.forEach(msg => {
                addMessageToChat(msg.role, msg.content || '', false); 
            });

            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';

            await carregarHistorico(); // Para re-selecionar o item ativo na sidebar

            if (messageInput) messageInput.focus();
            setTimeout(() => scrollToBottom(true), 100); // Atraso para garantir que o DOM está pronto

            if (window.innerWidth <= 1024) {
                closeSidebar();
            }
            console.log('Conversa carregada:', conversationIdToLoad);
        } catch (error) {
            console.error('Erro ao carregar conversa:', error.message);
            alert(`Erro ao carregar conversa: ${error.message}`);
            currentConversationId = null; // Reseta se falhar
        } finally {
            hideThinking(); // Esconde indicador
        }
    }


    async function deletarConversa(conversationIdToDelete, itemElement) {
        if (!conversationIdToDelete) return;
        const shouldConfirm = userSettings.chat.confirmDelete;
        if (shouldConfirm && !confirm('Tem certeza que deseja deletar esta conversa?')) {
            return;
        }

        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            alert("Autenticação necessária.");
            return;
        }

        console.log('Deletando conversa ID:', conversationIdToDelete);
        try {
            const response = await fetch(`/api/conversation/${conversationIdToDelete}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            const data = await response.json().catch(() => ({})); // Pega a resposta mesmo em erro

            if (!response.ok) {
                throw new Error(data.error || `Erro ao deletar conversa (${response.status})`);
            }

            if (itemElement) {
                itemElement.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                itemElement.style.transform = 'translateX(-100%)';
                itemElement.style.opacity = '0';
                setTimeout(() => {
                    itemElement.remove(); 
                    updateAboutStats(); 
                }, 300);
            } else { // Se o elemento não foi passado, recarrega o histórico
                await carregarHistorico();
                 updateAboutStats();
            }

            if (conversationIdToDelete === currentConversationId) {
                console.log('Conversa ativa deletada.');
                currentConversationId = null; 
                const allConvIds = [
                    ...(chatHistory.today || []),
                    ...(chatHistory.yesterday || []),
                    ...(chatHistory.week || []),
                    ...(chatHistory.older || [])
                ].map(c => c.id).filter(id => id !== conversationIdToDelete);

                if (allConvIds.length === 0) {
                    if (welcomeScreen) welcomeScreen.style.display = 'flex';
                    if (appContainer) appContainer.style.display = 'none';
                    limparInterface(); 
                } else {
                    // Tenta carregar a conversa mais recente que sobrou, ou cria uma nova
                    // Esta lógica pode ser complexa, por simplicidade, vamos criar uma nova.
                    const newConvId = await criarNovaConversa();
                    if (newConvId) {
                         if (welcomeScreen) welcomeScreen.style.display = 'none';
                         if (appContainer) appContainer.style.display = 'flex';
                    } else { // Se não conseguiu criar nova, volta para welcome
                        if (welcomeScreen) welcomeScreen.style.display = 'flex';
                        if (appContainer) appContainer.style.display = 'none';
                        limparInterface();
                    }
                }
            }
            console.log('Conversa deletada com sucesso:', conversationIdToDelete);
        } catch (error) {
            console.error('Erro ao deletar conversa:', error);
            alert(`Erro ao deletar conversa: ${error.message}`);
        }
    }

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
    }

    function autoResizeTextarea() {
        if (!this) return;
        this.style.height = 'auto'; 
        let newHeight = this.scrollHeight;
        const maxHeight = 120; 
        if (newHeight > maxHeight) newHeight = maxHeight;
        this.style.height = `${newHeight}px`;
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

    function addMessageToChat(sender, text, useTypingEffect = false) {
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);

        const showTimestampsSetting = userSettings.chat.showTimestamps;
        const timestampHTML = showTimestampsSetting ? `<div class="message-time" style="display: block;">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>` : `<div class="message-time" style="display: none;">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>`;

        const avatarContent = sender === 'user' ?
            (currentUser && currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U') :
            '<div class="logo-img" style="transform: scale(0.6); width:100%; height:100%; display:flex; align-items:center; justify-content:center;"><img src="logo.png" alt="Logo" style="width:18px; height:18px;"></div>';

        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-avatar">
                    <div class="avatar-circle">${avatarContent}</div>
                </div>
                <div class="message-bubble">
                    <div class="message-text"></div>
                    ${timestampHTML}
                </div>
            </div>
        `;
        
        const messageTextElement = messageDiv.querySelector('.message-text');
        if (!messageTextElement) {
            console.error("Elemento .message-text não encontrado ao adicionar mensagem.");
            return; 
        }
        chatMessages.appendChild(messageDiv);
        
        const formattedText = formatMessage(text || ""); // Garante que text seja string

        if (sender === 'ai' && useTypingEffect && userSettings.interface.typingEffect) {
            typeWriter(messageTextElement, formattedText);
        } else {
            messageTextElement.innerHTML = formattedText; 
        }
        scrollToBottom();
    }


    function typeWriter(element, text, speed = 10) { 
        element.innerHTML = ''; 
        let i = 0;
        const originalText = text; 

        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        
        let currentHtml = '';
        let isTag = false;

        function type() {
            if (i < originalText.length) {
                const char = originalText[i];
                if (char === '<') isTag = true;
                if (isTag) {
                    currentHtml += char;
                } else {
                    element.innerHTML = currentHtml + char; // Adiciona o char ao DOM para o cursor seguir
                }
                if (char === '>') isTag = false;


                if (!isTag && i === 0 && originalText.length > 0) element.appendChild(cursor);
                else if (!isTag && originalText.length > 0 && element.lastChild !== cursor) element.appendChild(cursor);

                if (isTag && i === originalText.length -1) { // Se terminar dentro de uma tag, renderiza o que tem
                     element.innerHTML = currentHtml;
                }
                
                i++;
                scrollToBottom(); 
                setTimeout(type, speed);
            } else {
                if (cursor.parentNode) cursor.remove(); 
                element.innerHTML = originalText; 
                scrollToBottom();
            }
        }

        if (originalText && originalText.length > 0) { 
           if (!isTag) element.appendChild(cursor); 
           type();
        } else {
            element.innerHTML = originalText; 
        }
    }


    function playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,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');
            audio.volume = 0.3; 
            audio.play().catch(e => console.warn('Som de notificação não pôde ser reproduzido:', e)); 
        } catch (error) {
            console.warn('Erro ao tentar reproduzir som de notificação:', error);
        }
    }

    // CORRIGIDA:
    function formatMessage(text) {
        if (typeof text !== 'string') {
            console.warn("formatMessage recebeu algo que não é string:", text);
            return ''; 
        }
        const _safe_text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        let formatted = _safe_text.replace(/\n/g, '<br>'); 
        
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__([^ _][^_]*?[^ _])__/g, '<strong>$1</strong>');
        
        formatted = formatted.replace(/(?<![a-zA-Z0-9*_])\*([^* \n][^*]*?[^* \n])\*(?![a-zA-Z0-9*_])/g, '<em>$1</em>');
        formatted = formatted.replace(/(?<![a-zA-Z0-9*_])_([^ _][^_]*?[^ _])_(?![a-zA-Z0-9*_])/g, '<em>$1</em>');

        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        formatted = formatted.replace(/```(?:[a-zA-Z0-9]+)?\s*\n([\s\S]*?)\n?```/g, (match, codeContent) => {
            const escapedCodeContent = codeContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<pre><code>${escapedCodeContent}</code></pre>`;
        });
        return formatted;
    }


    function scrollToBottom(force = false) {
        if (chatMessages) {
            if (force || isScrolledToBottom()) {
                chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
            }
        }
    }

    function isScrolledToBottom() {
        if (!chatMessages) return true; 
        const scrollThreshold = 50; 
        return chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + scrollThreshold;
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            currentUser = null; 
            currentConversationId = null; 
            if (loginScreen) loginScreen.style.display = 'flex';
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'none';
            preencherSecao('todayChats', [], 'Hoje');
            preencherSecao('yesterdayChats', [], 'Ontem');
            preencherSecao('weekChats', [], 'Últimos 7 dias');
            preencherSecao('olderChats', [], 'Conversas antigas');
            console.log("Usuário deslogado.");
        });
    }


    function formatTime(timestamp) { 
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now.getTime() - date.getTime(); 

            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 1) return date.toLocaleDateString('pt-BR');
            if (days === 1) return 'ontem';
            if (hours >= 1) return `${hours}h atrás`;
            if (minutes >= 1) return `${minutes}min atrás`;
            if (seconds < 5) return 'agora'; 
            return `${seconds}s atrás`;

        } catch (error) {
            console.warn("Erro ao formatar timestamp:", timestamp, error);
            return 'data inválida';
        }
    }


    if (messageInput) {
        messageInput.addEventListener('input', () => {
            // messageInput.placeholder = messageInput.value.trim() ? '' : 'Digite sua mensagem...';
        });
    }

    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => { 
            if (userSettings.interface.theme === 'auto') {
                applyTheme(); 
            }
        });
    }
    initializeApp();
});
