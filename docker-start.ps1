# ============================================================
# Sicredi Guardião 3.0 — Inicialização Docker para Windows
# ============================================================
# Uso: .\docker-start.ps1
# Pré-requisitos: Docker Desktop instalado e em execução
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     Sicredi Guardião 3.0 — Inicialização Docker     ║" -ForegroundColor Green
Write-Host "║     IBM AI Experiential Learning Lab 2026            ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------
# 1. Verificar Docker
# ------------------------------------------------------------
Write-Host "🔍 Verificando Docker..." -ForegroundColor Cyan
try {
    $dockerVersion = & docker version --format "{{.Server.Version}}" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker não está acessível" }
    Write-Host "   ✅ Docker $dockerVersion disponível" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker não encontrado ou não está em execução." -ForegroundColor Red
    Write-Host "      Instale o Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------
# 2. Verificar docker-compose
# ------------------------------------------------------------
try {
    $composeVersion = & docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker compose not found" }
    Write-Host "   ✅ Docker Compose disponível" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker Compose não encontrado." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# 3. Criar .env a partir do exemplo se não existir
# ------------------------------------------------------------
Write-Host ""
Write-Host "📋 Verificando arquivo de configuração..." -ForegroundColor Cyan
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "   ✅ .env criado a partir do .env.example" -ForegroundColor Green
        Write-Host "   ℹ️  Edite o arquivo .env para personalizar as configurações." -ForegroundColor Yellow
    } else {
        Write-Host "   ⚠️  Arquivo .env.example não encontrado. Continuando com padrões..." -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✅ .env encontrado" -ForegroundColor Green
}

# ------------------------------------------------------------
# 4. Construir e iniciar serviços
# ------------------------------------------------------------
Write-Host ""
Write-Host "🔨 Construindo e iniciando serviços..." -ForegroundColor Cyan
Write-Host "   Isso pode levar alguns minutos na primeira execução." -ForegroundColor Gray

& docker compose up --build -d 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Falha ao iniciar os serviços." -ForegroundColor Red
    Write-Host "   Execute 'docker compose logs' para ver os erros." -ForegroundColor Yellow
    exit 1
}
Write-Host "   ✅ Serviços iniciados" -ForegroundColor Green

# ------------------------------------------------------------
# 5. Aguardar backend
# ------------------------------------------------------------
Write-Host ""
Write-Host "⏳ Aguardando backend inicializar..." -ForegroundColor Cyan
$maxAttempts = 30
$attempt = 0
do {
    Start-Sleep -Seconds 2
    $attempt++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ Backend disponível em http://localhost:8000" -ForegroundColor Green
            break
        }
    } catch { }
    Write-Host "   ⏳ Tentativa $attempt/$maxAttempts..." -ForegroundColor Gray
} while ($attempt -lt $maxAttempts)

if ($attempt -ge $maxAttempts) {
    Write-Host "   ⚠️  Backend demorou mais que o esperado. Verifique os logs: docker compose logs backend" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 6. Verificar e baixar modelo Ollama
# ------------------------------------------------------------
Write-Host ""
Write-Host "🤖 Verificando modelo Ollama..." -ForegroundColor Cyan
$ollamaModel = "llama3.2:3b"

# Read model from .env if set
if (Test-Path ".env") {
    $envContent = Get-Content ".env" | Where-Object { $_ -match "^OLLAMA_MODEL=" }
    if ($envContent) {
        $ollamaModel = $envContent -replace "^OLLAMA_MODEL=", ""
    }
}

Start-Sleep -Seconds 5
try {
    $tagsResponse = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($tagsResponse.StatusCode -eq 200) {
        $tags = $tagsResponse.Content | ConvertFrom-Json
        $modelExists = $tags.models | Where-Object { $_.name -like "$ollamaModel*" }
        if ($modelExists) {
            Write-Host "   ✅ Modelo '$ollamaModel' disponível" -ForegroundColor Green
        } else {
            Write-Host "   📥 Baixando modelo '$ollamaModel'... (pode demorar alguns minutos)" -ForegroundColor Yellow
            & docker compose exec ollama ollama pull $ollamaModel 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Modelo '$ollamaModel' baixado com sucesso" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Falha ao baixar modelo. O sistema usará respostas simuladas." -ForegroundColor Yellow
            }
        }
    }
} catch {
    Write-Host "   ⚠️  Ollama não acessível. O sistema usará respostas simuladas." -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 7. Inicializar banco de dados
# ------------------------------------------------------------
Write-Host ""
Write-Host "🗄️  Inicializando banco de dados..." -ForegroundColor Cyan
try {
    & docker compose exec backend python -m app.db.seed 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Banco inicializado com dados demonstrativos" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  Banco já inicializado ou erro não crítico (tabelas existentes)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ℹ️  Inicialização do banco omitida (pode já estar configurado)" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 8. Resultado final
# ------------------------------------------------------------
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ Sicredi Guardião 3.0 está pronto!              ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║   Frontend:    http://localhost:3000                 ║" -ForegroundColor White
Write-Host "║   Backend API: http://localhost:8000                 ║" -ForegroundColor White
Write-Host "║   Docs API:    http://localhost:8000/docs            ║" -ForegroundColor White
Write-Host "║   Ollama:      http://localhost:11434                ║" -ForegroundColor White
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║   Usuários demo:                                     ║" -ForegroundColor White
Write-Host "║   Associados:  carlos, mariana, joao               ║" -ForegroundColor White
Write-Host "║   Analistas:   ana.ferreira, roberto.silva          ║" -ForegroundColor White
Write-Host "║   Admin:       admin  |  Senha: sicredi123           ║" -ForegroundColor White
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║   Para parar: docker compose down                   ║" -ForegroundColor Gray
Write-Host "║   Para logs:  docker compose logs -f                ║" -ForegroundColor Gray
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
