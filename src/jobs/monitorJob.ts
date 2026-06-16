// src/jobs/monitorJob.ts
import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { fetchCurrentPrices, fetchClosePrices } from '../services/priceService'
import { calculateRSI, interpretRSI } from '../services/indicatorService'
import { sendBuyAlert, sendSellAlert } from '../services/whatsappService'

const SYMBOLS = ['BTC', 'ETH', 'SOL']

const RSI_BUY = parseInt(process.env.RSI_BUY_THRESHOLD ?? '30')
const RSI_SELL = parseInt(process.env.RSI_SELL_THRESHOLD ?? '70')
const COOLDOWN_MINUTES = parseInt(process.env.ALERT_COOLDOWN_MINUTES ?? '60')
const INTERVAL = parseInt(process.env.CRON_INTERVAL_MINUTES ?? '5')

// Guarda último alerta por símbolo em memória (evita spam sem precisar de DB a cada tick)
const lastAlertSent: Record<string, Date> = {}

async function canSendAlert(symbol: string): Promise<boolean> {
  const last = lastAlertSent[symbol]
  if (!last) return true
  const diffMs = Date.now() - last.getTime()
  return diffMs > COOLDOWN_MINUTES * 60 * 1000
}

async function ensureCoins() {
  for (const symbol of SYMBOLS) {
    await prisma.coin.upsert({
      where: { symbol },
      update: {},
      create: {
        symbol,
        name: symbol === 'BTC' ? 'Bitcoin' : symbol === 'ETH' ? 'Ethereum' : 'Solana',
      },
    })
  }
}

export async function runMonitor() {
  console.log(`[Monitor] Iniciando ciclo — ${new Date().toISOString()}`)

  try {
    await ensureCoins()

    // 1. Busca preços atuais de todos de uma vez (1 request)
    const prices = await fetchCurrentPrices(SYMBOLS)

    for (const priceData of prices) {
      const { symbol, price, volume24h, change24h } = priceData

      try {
        // 2. Busca histórico para calcular RSI
        const closes = await fetchClosePrices(symbol, 30)
        const rsi = calculateRSI(closes)
        const { signal, description } = interpretRSI(rsi, RSI_BUY, RSI_SELL)

        console.log(`[${symbol}] Preço: $${price.toFixed(2)} | RSI: ${rsi} | Sinal: ${signal}`)

        // 3. Salva snapshot no banco
        const coin = await prisma.coin.findUnique({ where: { symbol } })
        if (!coin) continue

        await prisma.priceSnapshot.create({
          data: {
            coinId: coin.id,
            price,
            volume24h,
            change24h,
            rsi,
            signal,
          },
        })

        // 4. Se houver sinal de compra ou venda, envia WhatsApp
        if (signal !== 'hold' && (await canSendAlert(symbol))) {
          let delivered = false

          if (signal === 'buy') {
            delivered = await sendBuyAlert(symbol, price, rsi)
          } else if (signal === 'sell') {
            delivered = await sendSellAlert(symbol, price, rsi)
          }

          // Salva o alerta no banco
          await prisma.alert.create({
            data: {
              coinId: coin.id,
              type: signal,
              message: description,
              price,
              rsi,
              delivered,
            },
          })

          if (delivered) {
            lastAlertSent[symbol] = new Date()
            console.log(`[${symbol}] ✅ Alerta de ${signal.toUpperCase()} enviado via WhatsApp`)
          }
        }

        // Delay entre moedas para não bater no rate limit do CoinGecko (free tier = 30 req/min)
        await new Promise(r => setTimeout(r, 2000))
      } catch (err: any) {
        console.error(`[${symbol}] Erro:`, err.message)
      }
    }

    console.log(`[Monitor] Ciclo finalizado`)
  } catch (err: any) {
    console.error('[Monitor] Erro geral:', err.message)
  }
}

export function startMonitorJob() {
  // Executa uma vez na inicialização
  runMonitor()

  // Agenda pelo intervalo configurado
  // ex: a cada 5 min = "*/5 * * * *"
  const cronExpr = `*/${INTERVAL} * * * *`
  console.log(`[Monitor] Cron agendado: ${cronExpr} (a cada ${INTERVAL} minutos)`)

  cron.schedule(cronExpr, () => {
    runMonitor()
  })
}
