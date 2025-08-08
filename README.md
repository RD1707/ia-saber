# SABER - Sistema de Análise e Benefício Educacional em Relatório

**SABER** é um assistente educacional inteligente construído com foco em promover o aprendizado significativo de alunos e apoiar professores no processo de ensino-aprendizagem. Utilizando inteligência artificial com personalização de personalidade e memória contextual, o sistema gera respostas claras, motivadoras e adaptadas ao perfil do estudante.

## Principais Funcionalidades

* **Chat interativo com IA** educacional
* **Configurações de personalidade da IA**: profissional, amigável, criativo, técnico ou equilibrado
* **Histórico de conversas organizado** por datas
* **Painel de configurações avançadas** com controle de criatividade, contexto e tokens
* **Persistência com banco de dados** e API REST
* **Geração automática de títulos** para conversas
* **Interface moderna e responsiva**, com suporte a tema escuro

---

## Estrutura do Projeto

```
saber/
├── static/
│   ├── index.html        # Interface principal
│   ├── styles.css        # Estilo visual da aplicação
│   └── script.js         # Lógica de interface e interação com a API
├── server.js             # Servidor Node.js com integração à IA Cohere
├── db.js                 # Banco de dados e funções auxiliares (requer configuração)
├── .env                  # Chave de API e variáveis sensíveis (não incluído)
└── README.md             # Documentação do projeto
```

---

## Tecnologias Utilizadas

* **Frontend**: HTML5, CSS3 (Custom Design System), JavaScript
* **Backend**: Node.js + Express
* **IA**: [Cohere API](https://cohere.com/)
* **Banco de Dados**: (PostgreeSQL)
* **Outros**: LocalStorage, persistência de configurações, exportação de histórico em JSON

---

## Como Executar Localmente

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/saber.git
cd saber
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o arquivo `.env`

Crie um arquivo `.env` com sua chave da API da Cohere:

```
COHERE_API_KEY=sua_chave_aqui
```

### 4. Inicie o servidor

```bash
node server.js
```

Acesse: `http://localhost:3000`

---

## API Endpoints

* `POST /api/chat` – Envia mensagem e retorna resposta da IA
* `GET /api/history` – Recupera histórico de conversas
* `GET /api/conversation/:id` – Detalhes de uma conversa
* `POST /api/new-conversation` – Cria nova conversa
* `DELETE /api/conversation/:id` – Remove uma conversa
* `PUT /api/conversation/:id/title` – Atualiza o título da conversa
* `GET /api/stats` – Retorna estatísticas gerais

---

## Personalização

O usuário pode configurar:

* Temperatura da IA (criatividade)
* Tamanho da resposta (máx. tokens)
* Personalidade da IA
* Quantidade de mensagens anteriores (contexto)
* Tema claro/escuro
* Efeitos visuais e sonoros

Tudo isso está disponível através do **modal de configurações** com UI intuitiva.

---

## Uso Típico

1. O aluno inicia uma nova conversa com uma dúvida ou tema.
2. A IA responde com base no prompt educacional adaptado.
3. A conversa é salva automaticamente, com título gerado.
4. O histórico pode ser acessado, exportado ou apagado via interface.

---

## Diferenciais

* Foco **100% educacional**
* **Análise de contexto e memória da conversa**
* Interface moderna, leve e responsiva
* Integração com **IA customizável** por personalidade

---

## Requisitos

* Node.js v16 ou superior
* Chave de API da Cohere
* Navegador moderno (Chrome, Firefox, Edge)

---

## Contribuição

Pull Requests são bem-vindos! Caso deseje contribuir:

1. Fork este repositório
2. Crie uma branch (`git checkout -b minha-feature`)
3. Faça commit das mudanças (`git commit -m 'Nova funcionalidade'`)
4. Push para a branch (`git push origin minha-feature`)
5. Abra um Pull Request

---

## Equipe de Desenvolvimento

- **Ramon Pires**: Programador Principal e Líder do Projeto  
- **Kenai Almeida**: Desenvolvedor Frontend e Designer 
- **Stefano Morosini**: Desenvolvedor Full-stack
- **Guilherme Moura**: Desenvolvedor Full-stack e Vice-líder do Projeto
- **Ruan Reiler**: Designer Gráfico e UX/UI  
- **Lucas Borges**: Gestor de Documentação e Testes  
- **Luiz Otávio**: Desenvolvedor Front-End  
- **Ian de Paula**: Comunicação e Divulgação  

---

## 📜 Licença

Este projeto é de uso educacional e está em desenvolvimento por estudantes do Ensino Médio com foco em soluções tecnológicas aplicadas à educação.

