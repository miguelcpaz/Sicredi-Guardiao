#!/usr/bin/env bash
# ============================================================
# Sicredi Guardião 3.0 — Inicialização Docker para Linux/macOS
# ============================================================
# Uso: chmod +x docker-start.sh && ./docker-start.sh
# Pré-requisitos: Docker e Docker Compose instalados
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Sicredi Guardião 3.0 — Inicialização Docker     ║${NC}"
echo -e "${GREEN}║     IBM AI Experiential Learning Lab 2026            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ------------------------------------------------------------
# 1. Verificar Docker
# ------------------------------------------------------------
echo -e "${CYAN}🔍 Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}   ❌ Docker não encontrado.${NC}"
    echo -e "${YELLOW}      Instale: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}   ❌ Docker não está em execução.${NC}"
    echo -e "${YELLOW}      Inicie o Docker e tente novamente.${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ Docker disponível${NC}"

# ------------------------------------------------------------
# 2. Verificar docker compose
# ------------------------------------------------------------
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}   ❌ Docker Compose não encontrado.${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ Docker Compose disponível${NC}"

# ------------------------------------------------------------
# 3. Criar .env se não existir
# ------------------------------------------------------------
echo ""
echo -e "${CYAN}📋 Verificando arquivo de configuração...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}   ✅ .env criado a partir do .env.example${NC}"
    else
        echo -e "${YELLOW}   ⚠️  .env.example não encontrado. Usando padrões.${NC}"
    fi
else
    echo -e "${GREEN}   ✅ .env encontrado${NC}"
fi

# ------------------------------------------------------------
# 4. Build e start
# ------------------------------------------------------------
echo ""
echo -e "${CYAN}🔨 Construindo e iniciando serviços...${NC}"
$COMPOSE_CMD up --build -d
echo -e "${GREEN}   ✅ Serviços iniciados${NC}"

# ------------------------------------------------------------
# 5. Aguardar backend
# ------------------------------------------------------------
echo ""
echo -e "${CYAN}⏳ Aguardando backend inicializar...${NC}"
MAX=30; attempt=0
until curl -sf http://localhost:8000/health > /dev/null 2>&1 || [ $attempt -ge $MAX ]; do
    sleep 2; attempt=$((attempt+1))
    echo -e "${GRAY}   ⏳ Tentativa $attempt/$MAX...${NC}"
done

if [ $attempt -ge $MAX ]; then
    echo -e "${YELLOW}   ⚠️  Backend demorou. Verifique: $COMPOSE_CMD logs backend${NC}"
else
    echo -e "${GREEN}   ✅ Backend disponível em http://localhost:8000${NC}"
fi

# ------------------------------------------------------------
# 6. Modelo Ollama
# ------------------------------------------------------------
echo ""
echo -e "${CYAN}🤖 Verificando modelo Ollama...${NC}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
if [ -f ".env" ]; then
    ENV_MODEL=$(grep "^OLLAMA_MODEL=" .env | cut -d'=' -f2)
    [ -n "$ENV_MODEL" ] && OLLAMA_MODEL="$ENV_MODEL"
fi

sleep 5
if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    MODEL_EXISTS=$(curl -s http://localhost:11434/api/tags | grep -c "$OLLAMA_MODEL" || true)
    if [ "$MODEL_EXISTS" -gt 0 ]; then
        echo -e "${GREEN}   ✅ Modelo '$OLLAMA_MODEL' disponível${NC}"
    else
        echo -e "${YELLOW}   📥 Baixando modelo '$OLLAMA_MODEL'...${NC}"
        $COMPOSE_CMD exec ollama ollama pull "$OLLAMA_MODEL" || \
            echo -e "${YELLOW}   ⚠️  Falha ao baixar modelo. Sistema usará modo simulado.${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  Ollama não acessível. Sistema usará modo simulado.${NC}"
fi

# ------------------------------------------------------------
# 7. Seed
# ------------------------------------------------------------
echo ""
echo -e "${CYAN}🗄️  Inicializando banco de dados...${NC}"
$COMPOSE_CMD exec backend python -m app.db.seed 2>&1 || \
    echo -e "${YELLOW}   ℹ️  Banco já inicializado ou erro não crítico.${NC}"

# ------------------------------------------------------------
# 8. Resultado
# ------------------------------------------------------------
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Sicredi Guardião 3.0 está pronto!              ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${NC}║   Frontend:    http://localhost:3000                 ║${NC}"
echo -e "${NC}║   Backend API: http://localhost:8000                 ║${NC}"
echo -e "${NC}║   Docs API:    http://localhost:8000/docs            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${NC}║   admin / sicredi123  |  ana.ferreira / sicredi123  ║${NC}"
echo -e "${GRAY}║   Para parar: $COMPOSE_CMD down                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
