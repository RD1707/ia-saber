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

    const showChatInterface = (user) => {
        currentUser = user;
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';

        const userNameEl = document.querySelector('.user-name');
        const userInitialEl = document.getElementById('user-initial');
        if (userNameEl) userNameEl.textContent = user.name || 'Usuário';
        if (userInitialEl && user.name) userInitialEl.textContent = user.name.charAt(0).toUpperCase();

        carregarHistorico();
        if (!currentConversationId) {
            adicionarMensagemDeBoasVindas();
        }
    };

    const showLoginInterface = () => {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        limparHistoricoVisual();
    };

    function adicionarMensagemDeBoasVindas() {
        if (!chatMessages) return;
        chatMessages.innerHTML = `
        <div class="welcome-placeholder">
            <img src="assets/logo.png" alt="SABER Logo" class="welcome-logo">
            <h2>Como posso te ajudar hoje?</h2>
            <div class="suggested-prompts">
                <button class="prompt-btn" data-prompt="Explique a teoria da relatividade">Explique a teoria da relatividade</button>
                <button class="prompt-btn" data-prompt="Crie um plano de estudos para biologia">Crie um plano de estudos para biologia</button>
                <button class="prompt-btn" data-prompt="Como funciona uma rede neural?">Como funciona uma rede neural?</button>
            </div>
        </div>
    `;
        document.querySelectorAll('.prompt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const promptText = btn.dataset.prompt;
                messageInput.value = promptText;
                messageForm.requestSubmit();
            });
        });
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

        if (!currentConversationId) {
            adicionarMensagemDeBoasVindas();
        }
    }


    //================================================
    // 4. Lógica de Autenticação e Inicialização
    //================================================

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


    //================================================
    // 5. Gerenciamento de Eventos
    //================================================
    function setupEventListeners() {
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
        if (messageForm) messageForm.addEventListener('submit', handleSubmit);
        if (messageInput) {
            messageInput.addEventListener('input', autoResizeTextarea);
            messageInput.addEventListener('keydown', handleKeyDown);
        }
        if (newChatBtn) newChatBtn.addEventListener('click', handleNewConversationClick);
        if (headerMenuBtn) headerMenuBtn.addEventListener('click', toggleSidebar);
        if (sidebarToggle) sidebarToggle.addEventListener('click', openSettingsModal);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
        setupSettingsModal();
    }


    async function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password
                })
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
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

    //================================================
    // 6. Lógica do Chat e API
    //================================================

    async function sendMessage(message) {
        if (!currentConversationId) {
            console.error("Tentativa de enviar mensagem sem uma conversa ativa.");
            return;
        }

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
                await carregarHistorico();
            }

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            hideThinking();
            addMessageToChat('ai', `Desculpe, ocorreu um erro: ${error.message}`);
        }
    }

    // *** FUNÇÃO ADICIONADA ***
    function addMessageToChat(role, text, isAi = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', role);

        const avatar = document.createElement('div');
        avatar.classList.add('message-avatar');
        const avatarCircle = document.createElement('div');
        avatarCircle.classList.add('avatar-circle');

        if (isAi) {
            const logo = document.createElement('img');
            logo.src = 'assets/logo.png';
            logo.alt = 'SABER';
            avatarCircle.appendChild(logo);
        } else {
            avatarCircle.textContent = currentUser?.name?.charAt(0).toUpperCase() || 'U';
        }
        avatar.appendChild(avatarCircle);

        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble');
        const messageText = document.createElement('div');
        messageText.classList.add('message-text');

        // Simples conversão de markdown (negrito e itálico) para HTML
        let htmlContent = escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        messageText.innerHTML = htmlContent;

        bubble.appendChild(messageText);
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(bubble);
        chatMessages.appendChild(messageWrapper);
        scrollToBottom(true);
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
            await carregarHistorico();

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

    async function carregarHistorico() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch('/api/history', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
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
    
    // *** FUNÇÃO ADICIONADA ***
    function preencherSecao(containerId, conversas) {
        const container = document.getElementById(containerId);
        const section = document.getElementById(containerId.replace('Chats', 'Section'));
        if (!container || !section || conversas.length === 0) {
            if(section) section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = ''; // Limpa antes de adicionar
        conversas.forEach(conv => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'chat-history-item';
            item.dataset.id = conv.id;
            item.textContent = conv.title || 'Conversa sem título';
            item.title = conv.title;
            if (conv.id === currentConversationId) {
                item.classList.add('active');
            }
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                currentConversationId = conv.id;
                await carregarConversa(conv.id);
            });
            container.appendChild(item);
        });
    }

    async function carregarConversa(id) {
        showThinking();
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/conversation/${id}`, {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Não foi possível carregar a conversa.');

            const data = await response.json();
            chatMessages.innerHTML = '';
            data.messages.forEach(msg => {
                addMessageToChat(msg.role, msg.content, msg.role === 'assistant');
            });
            currentConversationId = id;
            document.querySelectorAll('.chat-history-item.active').forEach(i => i.classList.remove('active'));
            document.querySelector(`.chat-history-item[data-id="${id}"]`).classList.add('active');
            if (window.innerWidth <= 1024) closeSidebar();

        } catch(err) {
            console.error("Erro ao carregar conversa:", err);
            alert(err.message);
        } finally {
            hideThinking();
        }
    }


    //================================================
    // 7. Gerenciamento do Modal de Configurações
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

    /**
 * Adiciona os event listeners aos controles do modal de configurações.
 */
function setupSettingsControls() {
    const temperatureSlider = document.getElementById("temperature");
    const temperatureValueDisplay = document.querySelector('[for="temperature"]')?.nextElementSibling?.querySelector(".setting-value");

    if (temperatureSlider && temperatureValueDisplay) {
        temperatureSlider.addEventListener("input", e => {
            const value = parseFloat(e.target.value);
            userSettings.ai.temperature = value;
            temperatureValueDisplay.textContent = value.toFixed(1);
        });
    }

    document.getElementById("maxTokens")?.addEventListener("change", e => {
        userSettings.ai.maxTokens = parseInt(e.target.value);
    });
    document.getElementById("aiPersonality")?.addEventListener("change", e => {
        userSettings.ai.personality = e.target.value;
    });
    document.getElementById("contextMemory")?.addEventListener("change", e => {
        userSettings.ai.contextMemory = parseInt(e.target.value);
    });
    document.getElementById("theme")?.addEventListener("change", e => {
        userSettings.interface.theme = e.target.value;
        applyTheme();
    });
    document.getElementById("fontSize")?.addEventListener("change", e => {
        userSettings.interface.fontSize = e.target.value;
        applyFontSize();
    });
    document.getElementById("typingEffect")?.addEventListener("change", e => {
        userSettings.interface.typingEffect = e.target.checked;
    });
    document.getElementById("soundNotifications")?.addEventListener("change", e => {
        userSettings.interface.soundNotifications = e.target.checked;
    });
    document.getElementById("compactMode")?.addEventListener("change", e => {
        userSettings.interface.compactMode = e.target.checked;
        applyCompactMode();
    });
    document.getElementById("autoSave")?.addEventListener("change", e => {
        userSettings.chat.autoSave = e.target.checked;
    });
    document.getElementById("confirmDelete")?.addEventListener("change", e => {
        userSettings.chat.confirmDelete = e.target.checked;
    });
    document.getElementById("enterToSend")?.addEventListener("change", e => {
        userSettings.chat.enterToSend = e.target.checked;
    });
    document.getElementById("showTimestamps")?.addEventListener("change", e => {
        userSettings.chat.showTimestamps = e.target.checked;
        applyTimestampDisplay();
    });
}

/**
 * Adiciona listeners para os controles especiais (exportar, limpar).
 */
function setupSpecialControls() {
    document.getElementById("exportChats")?.addEventListener("click", exportConversations);
    document.getElementById("clearHistory")?.addEventListener("click", clearAllHistory);
}

/**
 * Carrega as configurações do usuário salvas no localStorage.
 */
function loadUserSettings() {
    try {
        const savedSettings = localStorage.getItem("saber_settings");
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            // Faz um merge para garantir que novas configurações não quebrem o app
            userSettings.ai = { ...userSettings.ai, ...parsedSettings.ai };
            userSettings.interface = { ...userSettings.interface, ...parsedSettings.interface };
            userSettings.chat = { ...userSettings.chat, ...parsedSettings.chat };
        }
    } catch (e) {
        console.warn("Erro ao carregar configurações:", e);
    }
}

/**
 * Salva as configurações atuais do usuário no localStorage.
 */
function saveUserSettings() {
    try {
        localStorage.setItem("saber_settings", JSON.stringify(userSettings));
        applySettings();
        const saveButton = document.getElementById("saveSettings");

        if (saveButton) {
            const originalText = saveButton.innerHTML;
            saveButton.innerHTML = '<i class="fas fa-check"></i> Salvo!';
            saveButton.disabled = true;
            saveButton.style.background = "hsl(120, 60%, 50%)";

            setTimeout(() => {
                saveButton.innerHTML = originalText;
                saveButton.style.background = "";
                saveButton.disabled = false;
            }, 2000);
        }
    } catch (e) {
        console.error("Erro ao salvar configurações:", e);
        alert("Erro ao salvar configurações.");
    }
}

/**
 * Restaura as configurações para os valores padrão.
 */
function resetUserSettings() {
    if (confirm("Tem certeza que deseja restaurar as configurações padrão?")) {
        userSettings = {
            ai: {
                temperature: 0.5,
                maxTokens: 300,
                personality: "balanced",
                contextMemory: 10
            },
            interface: {
                theme: "light",
                fontSize: "medium",
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
        updateSettingsUI();
        saveUserSettings();
        alert("Configurações restauradas para o padrão.");
    }
}

/**
 * Atualiza a interface do modal de configurações com os valores atuais.
 */
function updateSettingsUI() {
    const tempSlider = document.getElementById("temperature");
    if (tempSlider) {
        tempSlider.value = userSettings.ai.temperature;
    }
    const tempValueDisplay = document.querySelector('[for="temperature"]')?.nextElementSibling?.querySelector(".setting-value");
    if (tempValueDisplay) {
        tempValueDisplay.textContent = userSettings.ai.temperature.toFixed(1);
    }

    document.getElementById("maxTokens").value = userSettings.ai.maxTokens;
    document.getElementById("aiPersonality").value = userSettings.ai.personality;
    document.getElementById("contextMemory").value = userSettings.ai.contextMemory;
    document.getElementById("theme").value = userSettings.interface.theme;
    document.getElementById("fontSize").value = userSettings.interface.fontSize;
    document.getElementById("typingEffect").checked = userSettings.interface.typingEffect;
    document.getElementById("soundNotifications").checked = userSettings.interface.soundNotifications;
    document.getElementById("compactMode").checked = userSettings.interface.compactMode;
    document.getElementById("autoSave").checked = userSettings.chat.autoSave;
    document.getElementById("confirmDelete").checked = userSettings.chat.confirmDelete;
    document.getElementById("enterToSend").checked = userSettings.chat.enterToSend;
    document.getElementById("showTimestamps").checked = userSettings.chat.showTimestamps;
}

/**
 * Aplica todas as configurações visuais.
 */
function applySettings() {
    applyTheme();
    applyFontSize();
    applyCompactMode();
    applyTimestampDisplay();
}

/**
 * Aplica o tema (light/dark) ao body.
 */
function applyTheme() {
    document.body.removeAttribute("data-theme");
    if (userSettings.interface.theme === "dark") {
        document.body.setAttribute("data-theme", "dark");
    } else if (userSettings.interface.theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.body.setAttribute("data-theme", "dark");
    }
}

/**
 * Aplica o tamanho da fonte ao body.
 */
function applyFontSize() {
    document.body.classList.remove("font-small", "font-medium", "font-large");
    document.body.classList.add(`font-${userSettings.interface.fontSize}`);
}

/**
 * Aplica o modo compacto ao body.
 */
function applyCompactMode() {
    document.body.classList.toggle("compact-mode", userSettings.interface.compactMode);
}

/**
 * Controla a exibição dos timestamps nas mensagens.
 */
function applyTimestampDisplay() {
    chatMessages.classList.toggle("show-timestamps", userSettings.chat.showTimestamps);
}


    async function updateAboutStats() {
        // Esta função pode ser expandida para buscar estatísticas reais da API
        const totalConversations = [].concat(chatHistory.today, chatHistory.yesterday, chatHistory.week, chatHistory.older).length;
        const totalMessagesEl = document.getElementById('stats-total-messages');
        const totalConversationsEl = document.getElementById('stats-total-conversations');
        
        if (totalConversationsEl) {
            totalConversationsEl.textContent = totalConversations;
        }
        // Exemplo: como você poderia buscar o total de mensagens se a API suportasse
        // if(totalMessagesEl) {
        //     const stats = await fetch('/api/stats').then(res => res.json());
        //     totalMessagesEl.textContent = stats.totalMessages;
        // }
    }

    async function exportConversations() { alert('Funcionalidade de exportar ainda não implementada.'); }
    async function clearAllHistory() { 
        if(confirm('Tem certeza que deseja apagar todo o seu histórico de conversas? Esta ação não pode ser desfeita.')) {
            alert('Funcionalidade de apagar histórico ainda não implementada.'); 
        }
    }


    //================================================
    // 9. Funções de Sidebar e Layout
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
    // 10. Funções Auxiliares e Utilitários
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
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    initializeApp();
});