# Sicredi Guardião V2 — Cloud + IA Agêntica

**IBM AI Experiential Learning Lab 2026 — Trilha 4, Sicredi**  
Desenvolvido pela equipe ByteLab

---

## Visão Geral

O Sicredi Guardião V2 é uma solução de IA agêntica para prevenção a fraudes em compras com cartões. O sistema identifica comportamentos suspeitos, analisa evidências, recomenda intervenções proporcionais ao risco e protege associados por meio de ações simuladas e reversíveis.

### Arquitetura

```
React + TypeScript (Frontend)
        │  HTTP/SSE
        ▼
FastAPI (Backend)
  ├── Motor antifraude (regras determinísticas — score imutável)
  ├── Groq AI (análise, chat, investigação agêntica)
  │     └── Function Calling → Agent Tools (validados pelo backend)
  ├── SQLite (local/dev) / PostgreSQL Neon (produção)
  └── Alembic (migrations)
```

---

## Funcionalidades

### Motor Antifraude (Determinístico)
- 7 regras de risco: `high_amount`, `unusual_hour`, `unknown_merchant`, `high_frequency`, `unusual_category`, `unusual_location`, `velocity_amount`
- Score 0–100 (baixo < 30, médio 30–69, alto ≥ 70)
- Score calculado pelo motor é **imutável** — a IA nunca o modifica
- Correção na V2: R04 (frequência) agora conta transações reais na janela de 1 hora

### Guardião AI — Groq (llama-3.1-8b-instant)
- Chat do analista com contexto de transação, perfil comportamental e histórico de investigação
- Chat do associado com contexto limitado (sem scores internos)
- Streaming SSE com indicação de provedor
- Fallback claro quando Groq indisponível ou cota gratuita esgotada

### IA Agêntica (Function Calling)
- Analistas fazem perguntas em linguagem natural e o agente consulta dados reais
- Ferramentas de leitura: `get_transaction_details`, `get_transaction_risk`, `get_associate_transaction_history`, `get_behavior_profile`, `get_related_alerts`, `get_related_incidents`, `get_recent_transactions`
- Ferramentas de intervenção: `request_transaction_review`, `request_transaction_hold`, `create_fraud_alert`, `open_fraud_incident`, `notify_associate`
- Todas as ferramentas validam autenticação, autorização por carteira e tipo de usuário
- Máximo 10 chamadas de ferramenta por invocação (proteção de cota)

### Banco de Dados
- **Local:** SQLite (sem configuração)
- **Produção:** PostgreSQL no Neon (camada gratuita, TLS obrigatório)
- Migrations com Alembic (schema completo para banco vazio)
- `safe_seed()` idempotente no startup — não sobrescreve dados existentes

---

## Configuração Rápida

### 1. Requisitos

- Python 3.10+ instalado
- Node.js 18+ instalado (para o frontend)
- Conta Groq (gratuita) para obter `GROQ_API_KEY`

### 2. Backend

```powershell
# Instalar dependências
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Configurar variáveis de ambiente
Copy-Item .env.example .env
# Edite .env e configure:
#   GROQ_API_KEY=sua-chave-aqui
#   (opcional) DATABASE_URL para Neon

# Iniciar
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:5173

---

## Configuração do Groq (Gratuito)

1. Acesse https://console.groq.com
2. Faça login (sem cartão de crédito)
3. Clique em **API Keys → Create API Key**
4. Copie a chave e adicione ao `backend/.env`:
   ```
   GROQ_API_KEY=gsk_...sua-chave-aqui
   AI_PROVIDER=groq
   GROQ_MODEL=llama-3.1-8b-instant
   ```
5. Reinicie o backend

**Modelo recomendado:** `llama-3.1-8b-instant` — disponível na camada gratuita, baixa latência, adequado para análise de fraudes e chat conversacional.

**Limites da camada gratuita (verificar em console.groq.com):**
- ~14.400 requisições/dia e 6.000 tokens/minuto no plano gratuito (mais que suficiente para demonstração)
- O sistema trata HTTP 429 e informa a cota ao usuário

---

## Configuração do Neon PostgreSQL (Gratuito)

1. Acesse https://neon.tech e crie uma conta gratuita
2. Crie um novo projeto (Free tier)
3. Copie a **Connection String** em formato psycopg:
   ```
   postgresql+psycopg://USER:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Configure no `backend/.env`:
   ```
   DATABASE_URL=postgresql+psycopg://USER:PASSWORD@ep-xxx...neon.tech/neondb?sslmode=require
   ```
5. Execute a migração inicial:
   ```powershell
   cd backend
   python -m alembic upgrade head
   ```
6. Popule com dados de demonstração:
   ```powershell
   python -c "from app.db.seed import safe_seed; safe_seed()"
   ```

**Driver:** psycopg 3 (puro Python, sem `libpq` necessário no sistema)

---

## Migrações com Alembic

```powershell
cd backend

# Aplicar todas as migrações pendentes
python -m alembic upgrade head

# Ver status atual
python -m alembic current

# Criar nova migração a partir de mudanças nos models
python -m alembic revision --autogenerate -m "descricao"

# Reverter uma migração
python -m alembic downgrade -1
```

Para banco Neon, defina `DATABASE_URL` no ambiente antes de executar:
```powershell
$env:DATABASE_URL = "postgresql+psycopg://..."
python -m alembic upgrade head
```

---

## Credenciais de Demonstração

| Tipo | Usuário | Senha |
|------|---------|-------|
| Associado | carlos / mariana / joao / beatriz / lucas | sicredi123 |
| Analista | ana.ferreira / roberto.silva | sicredi123 |
| Admin | admin | sicredi123 |

**Carteiras:**
- `ana.ferreira` → carlos, mariana, joao
- `roberto.silva` → beatriz, lucas

---

## Casos de Demonstração Pré-carregados

| Caso | Associado | Valor | Score | Status | Destaque |
|------|-----------|-------|-------|--------|----------|
| 1 | Carlos | R$ 85 | 0/100 | Aprovada | Transação normal |
| 2 | Mariana | R$ 2.800 | 50/100 | Em análise | PIX valor atípico |
| 3 | Lucas | R$ 450 | 45/100 | Em análise | Madrugada + local atípico |
| 4 | João | R$ 8.500 | 100/100 | Bloqueada | 6 fatores, fraude suspeita |
| 5 | Beatriz | R$ 3.200 | 70/100 | Investigando | Contestada, investigação ativa |
| 6 | Carlos | R$ 1.500 | 60/100 | Resolvida | Confirmada, caso encerrado |
| **7 (DEMO)** | **Carlos** | **R$ 5.800** | **100/100** | **Bloqueada** | **IBM AI Lab — R01+R02+R03+R05+R06+R07** |

### Roteiro de Demonstração — IBM AI Lab 2026

1. **Login como analista** (`ana.ferreira / sicredi123`)
2. **Abrir o painel de alertas** → localizar o Caso 7 (Carlos, R$5.800)
3. **Chat do Guardião AI** → sessão vinculada à transação 7
   - Perguntar: *"Explique os fatores de risco desta transação"*
   - Perguntar: *"Compare com o histórico do Carlos"*
   - Perguntar: *"Quais ações você recomenda?"*
4. **Investigação Agêntica** (`POST /api/v1/agent/investigate`)
   ```json
   {
     "transaction_id": <id_do_caso_7>,
     "question": "Analise a transação e recomende ações preventivas"
   }
   ```
   O agente irá:
   - Consultar detalhes da transação via `get_transaction_details`
   - Buscar o risco via `get_transaction_risk`
   - Comparar com histórico via `get_associate_transaction_history`
   - Recomendar e possivelmente solicitar `notify_associate` ou `request_transaction_review`
5. **Login como associado** (`carlos / sicredi123`)
   - Ver notificação da transação bloqueada
   - Usar o chat do Guardião IA para entender o alerta
   - Confirmar ou contestar a transação

---

## API Endpoints

### Autenticação
```
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

### Transações
```
POST /api/v1/transactions        # criar + analisar (associado)
GET  /api/v1/transactions        # listar (por papel/carteira)
GET  /api/v1/transactions/{id}   # detalhes
```

### Chat do Analista
```
GET  /api/v1/ai/status                        # status do provedor
POST /api/v1/ai/sessions                      # criar/recuperar sessão
POST /api/v1/ai/sessions/free                 # sessão livre
PATCH /api/v1/ai/sessions/{id}/rename
DELETE /api/v1/ai/sessions/{id}
POST /api/v1/ai/sessions/{id}/message         # mensagem (não-streaming)
GET  /api/v1/ai/sessions/{id}/stream          # stream SSE
GET  /api/v1/ai/sessions/{id}/messages        # histórico
GET  /api/v1/ai/sessions                      # listar sessões
```

### **NOVO — Agente de Investigação**
```
POST /api/v1/agent/investigate   # investigação agêntica com function calling
```
Corpo:
```json
{
  "transaction_id": 7,
  "question": "Analise esta transação e recomende ações preventivas."
}
```
Resposta:
```json
{
  "answer": "...",
  "provider": "groq",
  "tool_calls": [
    {"tool_name": "get_transaction_details", "args": {...}, "result": {...}},
    {"tool_name": "get_related_alerts", "args": {...}, "result": {...}}
  ],
  "transaction_id": 7,
  "warning": null
}
```

### Chat do Associado
```
POST /api/v1/ai/associate/sessions
GET  /api/v1/ai/associate/sessions
DELETE /api/v1/ai/associate/sessions/{id}
POST /api/v1/ai/associate/sessions/{id}/message
GET  /api/v1/ai/associate/sessions/{id}/stream
GET  /api/v1/ai/associate/sessions/{id}/messages
POST /api/v1/ai/associate/chat   # legado stateless
```

### Alertas, Incidentes, Notificações, PIX, Dashboard
```
GET/POST/PATCH /api/v1/alerts/...
GET/POST /api/v1/incidents/...
GET/PATCH /api/v1/notifications/...
POST /api/v1/pix/transfer
GET /api/v1/dashboard/...
```

### Health
```
GET /health   # status, versão, provedor AI, banco
```

---

## Ferramentas Disponibilizadas ao Guardião AI

### Leitura (analista/admin)
| Ferramenta | Descrição |
|-----------|-----------|
| `get_transaction_details` | Detalhes completos da transação |
| `get_transaction_risk` | Score, nível e fatores de risco |
| `get_associate_transaction_history` | Histórico de transações (até 50) |
| `get_behavior_profile` | Perfil comportamental do associado |
| `get_related_alerts` | Alertas vinculados à transação |
| `get_related_incidents` | Incidentes e histórico de eventos |
| `get_recent_transactions` | Transações em janela de tempo (velocidade) |

### Intervenção (analista/admin — validadas pelo backend)
| Ferramenta | Descrição |
|-----------|-----------|
| `request_transaction_review` | Solicita revisão humana (registra evento) |
| `request_transaction_hold` | Retém transação `→ pending_review` [REVERSÍVEL] |
| `create_fraud_alert` | Cria alerta de fraude |
| `open_fraud_incident` | Abre incidente formal |
| `notify_associate` | Envia notificação ao associado |

**Regras de segurança das ferramentas:**
- A IA solicita, o backend valida e executa
- Intervenções exigem role `analyst` ou `admin`
- Wallet access validado em cada chamada
- Todas as ações geram `AuditLog`
- Idempotência: incidentes duplicados retornam o existente
- Máximo 10 chamadas por invocação

---

## Testes

```powershell
cd backend

# Suite completa (exceto integrações externas)
python -m pytest tests/ -q --ignore=tests/test_ollama_integration.py

# Apenas testes do agente e providers
python -m pytest tests/test_gemini_provider.py -v

# Apenas motor antifraude
python -m pytest tests/test_fraud_engine.py -v

# Testes de autorização
python -m pytest tests/test_authorization.py -v
```

**Resultado atual: 134 testes aprovados, 0 falhas**

Testes que exigem credenciais externas:
- `test_ollama_integration.py` — ignorado automaticamente se Ollama não estiver rodando
- Testes de integração real com Groq — requerem `GROQ_API_KEY` configurada (não incluídos na suite automática)

---

## Variáveis de Ambiente Completas

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | `sqlite:///./guardiao_v2.db` | URL do banco |
| `SECRET_KEY` | *(obrigatório mudar)* | Chave JWT |
| `AI_PROVIDER` | `groq` | Provedor: groq/mock/gemini/ollama |
| `GROQ_API_KEY` | *(vazio)* | Chave Groq (console.groq.com) |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Modelo Groq |
| `GROQ_TIMEOUT_SECONDS` | `15` | Timeout da API |
| `GEMINI_API_KEY` | *(vazio)* | Chave Google AI Studio (opcional) |
| `GEMINI_MODEL` | `gemini-2.0-flash-lite` | Modelo Gemini (opcional) |
| `GEMINI_TIMEOUT_SECONDS` | `30` | Timeout da API Gemini |
| `GEMINI_MAX_OUTPUT_TOKENS` | `1024` | Limite de tokens Gemini |
| `GEMINI_MAX_CALLS_PER_SESSION` | `50` | Proteção de cota Gemini |
| `OLLAMA_URL` | `http://localhost:11434` | URL Ollama (opcional) |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Origens CORS |
| `DEBUG` | `false` | Log verboso |

---

## Arquivos Criados/Modificados nesta Versão

### Novos
| Arquivo | Descrição |
|---------|-----------|
| `backend/app/services/agent_tools.py` | Catálogo de ferramentas agênticas (leitura + intervenção) |
| `backend/app/api/v1/agent.py` | Endpoint `/agent/investigate` com loop agêntico |
| `backend/migrations/` | Configuração Alembic + migração inicial completa |
| `backend/tests/test_gemini_provider.py` | 30 testes: providers, agente, autorização, segurança |

### Modificados
| Arquivo | O que mudou |
|---------|-------------|
| `backend/app/core/config.py` | AI_PROVIDER padrão = groq; Groq como provider principal |
| `backend/app/providers/ai_provider.py` | GeminiProvider com function calling, backoff, extração de texto |
| `backend/app/services/ai_chat_service.py` | Suporte Groq/Gemini, streaming por chunks, check_ai_status |
| `backend/app/services/fraud_service.py` | Correção R04: conta transações reais na janela de 1h |
| `backend/app/db/database.py` | Suporte PostgreSQL/Neon com pool_pre_ping, pool_recycle |
| `backend/app/db/seed.py` | Caso 7 (DEMO IBM AI Lab — Carlos R$5.800, 100/100, 6 fatores) |
| `backend/app/api/v1/ai_chat.py` | /ai/status usa check_ai_status (suporta Groq/Gemini/Ollama/Mock) |
| `backend/app/main.py` | Registra router do agente; health check com status do banco |
| `backend/requirements.txt` | Adicionados: psycopg>=3.1.0, alembic>=1.13.0 |
| `backend/.env.example` | Groq como provider principal + instruções |
| `.env.example` | Atualizado para V2 com Groq como padrão |
| `backend/tests/test_fraud_engine.py` | Testes R04 frequency fix |
| `backend/app/models/models.py` | Documentação PostgreSQL/SQLite compatibility |

---

## Pendências que requerem credenciais externas

1. **GROQ_API_KEY** — integração real com Groq não testada sem chave
   - Obter em: https://console.groq.com (gratuito)
   - Configurar em `backend/.env`

2. **DATABASE_URL para Neon** — PostgreSQL não testado sem connection string
   - Obter em: https://neon.tech (gratuito)
   - Configurar em `backend/.env`
   - Executar: `python -m alembic upgrade head`

3. **Deploy** — não realizado (sem credenciais de nuvem)
   - Backend preparado para Uvicorn em produção
   - CORS configurável por variável de ambiente
   - Health check implementado em `/health`

---

## Custo Financeiro

**R$ 0,00** — todos os serviços utilizados são gratuitos:
- Groq: camada gratuita (sem faturamento)
- Neon PostgreSQL: Free Tier (sem cartão de crédito)
- SQLite: embutido no Python
- Alembic: open source

---

## Segurança

- Chaves de API nunca logadas, expostas em resposta ou hardcoded
- Scores calculados pelo motor são imutáveis — IA não pode alterá-los
- Ferramentas agênticas validam autenticação e autorização por carteira em cada chamada
- Proteção contra prompt injection: guard explícito em ambos os chats
- Rate limiting: máximo 10 tool calls por invocação de agente
- Separação explícita de contextos: analista (dados internos) vs associado (dados limitados)
- Todas as intervenções geram AuditLog com actor, action, entity e justificativa
- Bloqueios simulados são reversíveis e rastreáveis

---

## Sicredi Guardião V2 — Arquitetura Cloud + IA Agêntica

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                    │
│  Analista: Chat AI, Alertas, Incidentes, Simulador  │
│  Associado: Dashboard, PIX, Notificações, Chat IA   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP REST + SSE
┌──────────────────────▼──────────────────────────────┐
│              FastAPI Backend (Python)               │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐ │
│  │  Motor Antifraude│  │    Guardião AI Agent     │ │
│  │  (Determinístico)│  │    (Groq API)            │ │
│  │  Score 0-100     │  │    llama-3.1-8b-instant  │ │
│  │  7 regras        │  │    Function Calling      │ │
│  └────────┬────────┘  └──────────┬───────────────┘ │
│           │Score imutável        │Ferramentas       │
│  ┌────────▼─────────────────────▼───────────────┐  │
│  │          Agent Tools (Validadas)              │  │
│  │  Leitura: transações, risco, histórico        │  │
│  │  Intervenção: revisão, retenção, incidente    │  │
│  └──────────────────────┬────────────────────────┘  │
│                         │                            │
│  ┌──────────────────────▼────────────────────────┐  │
│  │       SQLAlchemy ORM + Alembic Migrations     │  │
│  └──────────────────────┬────────────────────────┘  │
└─────────────────────────┼───────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
   ┌──────▼──────┐                 ┌──────▼──────┐
   │   SQLite    │                 │  PostgreSQL  │
   │ (local/dev) │                 │  Neon Cloud  │
   └─────────────┘                 └─────────────┘
```

**Fluxo de análise antifraude:**
1. Associado submete transação → FastAPI persiste no banco
2. `FraudRulesEngine.analyze()` calcula score determinístico (0–100) ← **IMUTÁVEL**
3. Sistema registra `RiskAnalysis` com score + evidências + `provider="engine"`
4. Groq recebe contexto (transação + perfil + score) e gera explicação em linguagem natural
5. Se score ≥ 30: cria `Alert`; se ≥ 70: cria `Incident` + bloqueia transação
6. Notificação enviada ao associado e ao analista
7. Analista usa Chat AI ou Agente para investigar, com ferramentas autorizadas
8. Ações executadas pelo backend (nunca diretamente pela IA)
9. Tudo auditado em `AuditLog`
