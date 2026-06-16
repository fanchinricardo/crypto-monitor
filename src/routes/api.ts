// src/routes/api.ts
import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { fetchCurrentPrices, fetchClosePrices } from '../services/priceService'
import { calculateRSI, interpretRSI } from '../services/indicatorService'
import { sendWhatsApp } from '../services/whatsappService'
import { runMonitor } from '../jobs/monitorJob'

const RSI_BUY = parseInt(process.env.RSI_BUY_THRESHOLD ?? '30')
const RSI_SELL = parseInt(process.env.RSI_SELL_THRESHOLD ?? '70')

export async function apiRoutes(app: FastifyInstance) {
  // GET /health — healthcheck do Railway
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  // GET /status — resumo atual de todas as moedas
  app.get('/status', async (_, reply) => {
    try {
      const prices = await fetchCurrentPrices(['BTC', 'ETH', 'SOL'])
      const result = []

      for (const p of prices) {
        const closes = await fetchClosePrices(p.symbol, 30)
        const rsi = calculateRSI(closes)
        const { signal, description } = interpretRSI(rsi, RSI_BUY, RSI_SELL)

        result.push({
          symbol: p.symbol,
          price: p.price,
          change24h: p.change24h,
          volume24h: p.volume24h,
          rsi,
          signal,
          description,
        })

        await new Promise(r => setTimeout(r, 1500))
      }

      return { data: result, updatedAt: new Date().toISOString() }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // GET /alerts?limit=20 — histórico de alertas
  app.get<{ Querystring: { limit?: string; symbol?: string } }>('/alerts', async (req, reply) => {
    const limit = Math.min(parseInt(req.query.limit ?? '20'), 100)
    const symbol = req.query.symbol?.toUpperCase()

    const alerts = await prisma.alert.findMany({
      where: symbol
        ? { coin: { symbol } }
        : undefined,
      include: { coin: { select: { symbol: true, name: true } } },
      orderBy: { sentAt: 'desc' },
      take: limit,
    })

    return { data: alerts }
  })

  // GET /snapshots/:symbol?limit=50 — histórico de snapshots de preço
  app.get<{ Params: { symbol: string }; Querystring: { limit?: string } }>(
    '/snapshots/:symbol',
    async (req, reply) => {
      const symbol = req.params.symbol.toUpperCase()
      const limit = Math.min(parseInt(req.query.limit ?? '50'), 200)

      const coin = await prisma.coin.findUnique({ where: { symbol } })
      if (!coin) return reply.status(404).send({ error: 'Moeda não encontrada' })

      const snapshots = await prisma.priceSnapshot.findMany({
        where: { coinId: coin.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return { symbol, data: snapshots }
    }
  )

  // POST /test-whatsapp — testa envio de mensagem
  app.post('/test-whatsapp', async (_, reply) => {
    const sent = await sendWhatsApp('🤖 *Crypto Monitor* funcionando! Alertas de BTC, ETH e SOL ativos.')
    return sent
      ? { ok: true, message: 'Mensagem enviada com sucesso' }
      : reply.status(500).send({ ok: false, message: 'Falha ao enviar. Verifique as envs da Evolution API.' })
  })

  // POST /run-now — força execução imediata do monitor (útil para testar)
  app.post('/run-now', async () => {
    runMonitor() // não awaita para não bloquear o response
    return { ok: true, message: 'Ciclo de monitoramento iniciado em background' }
  })

  // GET /configs — lê configs dinâmicas do banco
  app.get('/configs', async () => {
    const configs = await prisma.config.findMany()
    return { data: configs }
  })

  // PUT /configs — atualiza config dinâmica (ex: thresholds RSI via API)
  app.put<{ Body: { key: string; value: string } }>('/configs', async (req, reply) => {
    const { key, value } = req.body
    if (!key || !value) return reply.status(400).send({ error: 'key e value são obrigatórios' })

    const config = await prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })

    return { data: config }
  })
}
