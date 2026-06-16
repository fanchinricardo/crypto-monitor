# 🚀 Crypto Monitor

Monitor automático de BTC, ETH e SOL com alertas de compra/venda via WhatsApp (Evolution API), banco de dados no Nhost e hospedagem no Railway.

---

## Stack

- **Backend**: Node.js + Fastify + TypeScript
- **Banco**: PostgreSQL via Nhost (Prisma ORM)
- **Indicador**: RSI (14 períodos) via CoinGecko API (gratuito)
- **Alertas**: WhatsApp via Evolution API
- **Hospedagem**: Railway

---

## Como funciona

1. A cada `CRON_INTERVAL_MINUTES` (padrão: 5 min), o sistema busca o preço atual de BTC, ETH e SOL na CoinGecko
2. Calcula o RSI dos últimos 30 dias
3. Se RSI ≤ 30 → envia alerta de **COMPRA** no WhatsApp
4. Se RSI ≥ 70 → envia alerta de **VENDA** no WhatsApp
5. Cooldown de `ALERT_COOLDOWN_MINUTES` (padrão: 60 min) entre alertas da mesma moeda para evitar spam
6. Tudo fica salvo no banco (snapshots de preço + histórico de alertas)

---

## Setup local

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 3. Rodar migrations no Nhost
```bash
npx prisma db push
```

### 4. Iniciar em modo dev
```bash
npm run dev
```

---

## Deploy no Railway

### 1. Criar projeto no Railway
- Acesse [railway.app](https://railway.app) e crie um novo projeto
- Clique em **Deploy from GitHub repo** e selecione este repositório

### 2. Configurar variáveis de ambiente no Railway
Vá em **Variables** e adicione:

```
DATABASE_URL=postgresql://postgres:SENHA@db.PROJETO.nhost.run:5432/postgres
EVOLUTION_API_URL=https://sua-instancia.evolution-api.com
EVOLUTION_API_KEY=sua-api-key
EVOLUTION_INSTANCE=Fiadoapp
WHATSAPP_NUMBER=5511999999999
PORT=3000
CRON_INTERVAL_MINUTES=5
RSI_BUY_THRESHOLD=30
RSI_SELL_THRESHOLD=70
ALERT_COOLDOWN_MINUTES=60
```

### 3. O Railway detecta o Dockerfile automaticamente
O deploy acontece automático a cada push na branch main.

---

## Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Healthcheck |
| GET | `/api/status` | Preço + RSI atual das 3 moedas |
| GET | `/api/alerts?symbol=BTC&limit=20` | Histórico de alertas |
| GET | `/api/snapshots/BTC?limit=50` | Histórico de preços salvos |
| POST | `/api/test-whatsapp` | Envia mensagem de teste no WhatsApp |
| POST | `/api/run-now` | Força execução imediata do monitor |
| GET | `/api/configs` | Lê configs dinâmicas |
| PUT | `/api/configs` | Atualiza config `{ key, value }` |

---

## Nhost — Como pegar a DATABASE_URL

1. Acesse [app.nhost.io](https://app.nhost.io)
2. Selecione seu projeto
3. Vá em **Database** → **Connection string**
4. Copie a string no formato `postgresql://...`

---

## Evolution API — Pré-requisitos

- Instância criada e conectada ao WhatsApp (`Fiadoapp` ou outra)
- `EVOLUTION_INSTANCE` = nome da instância
- `WHATSAPP_NUMBER` = número com DDI, sem `+` ou espaços (ex: `5511999999999`)

---

## Ajustar estratégia RSI

Edite as variáveis de ambiente:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `RSI_BUY_THRESHOLD` | 30 | RSI abaixo disso = sinal de compra |
| `RSI_SELL_THRESHOLD` | 70 | RSI acima disso = sinal de venda |
| `CRON_INTERVAL_MINUTES` | 5 | Frequência de checagem |
| `ALERT_COOLDOWN_MINUTES` | 60 | Cooldown entre alertas da mesma moeda |

---

## Exemplo de mensagem WhatsApp

```
🟢 SINAL DE COMPRA — BTC

💰 Preço atual: $58,320.00
📊 RSI (14): 28.4

📌 O RSI está abaixo de 30, indicando zona de sobrevenda.
Pode ser uma boa oportunidade de entrada.

⚠️ Este é um alerta automático baseado em indicador técnico.
Faça sua própria análise antes de operar.

🤖 Crypto Monitor — 16/06/2025 14:32:00
```
