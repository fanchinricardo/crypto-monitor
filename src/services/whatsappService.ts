// src/services/whatsappService.ts
import axios from 'axios'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = process.env.EVOLUTION_INSTANCE!
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER!

function buildBuyMessage(symbol: string, price: number, rsi: number): string {
  const priceFormatted = price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })

  return [
    `🟢 *SINAL DE COMPRA — ${symbol}*`,
    ``,
    `💰 Preço atual: *${priceFormatted}*`,
    `📊 RSI (14): *${rsi}*`,
    ``,
    `📌 O RSI está abaixo de ${process.env.RSI_BUY_THRESHOLD ?? 30}, indicando zona de *sobrevenda*.`,
    `Pode ser uma boa oportunidade de entrada.`,
    ``,
    `⚠️ _Este é um alerta automático baseado em indicador técnico. Faça sua própria análise antes de operar._`,
    ``,
    `🤖 _Crypto Monitor — ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`,
  ].join('\n')
}

function buildSellMessage(symbol: string, price: number, rsi: number): string {
  const priceFormatted = price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })

  return [
    `🔴 *SINAL DE VENDA — ${symbol}*`,
    ``,
    `💰 Preço atual: *${priceFormatted}*`,
    `📊 RSI (14): *${rsi}*`,
    ``,
    `📌 O RSI está acima de ${process.env.RSI_SELL_THRESHOLD ?? 70}, indicando zona de *sobrecompra*.`,
    `Pode ser uma boa hora para realizar lucros.`,
    ``,
    `⚠️ _Este é um alerta automático baseado em indicador técnico. Faça sua própria análise antes de operar._`,
    ``,
    `🤖 _Crypto Monitor — ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`,
  ].join('\n')
}

function buildSummaryMessage(
  items: Array<{ symbol: string; price: number; rsi: number; change24h: number; signal: string }>
): string {
  const lines = [
    `📈 *RESUMO CRIPTO*`,
    ``,
    ...items.map(item => {
      const arrow = item.change24h >= 0 ? '🔼' : '🔽'
      const sigEmoji = item.signal === 'buy' ? '🟢' : item.signal === 'sell' ? '🔴' : '🟡'
      const priceStr = item.price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
      return `${sigEmoji} *${item.symbol}*: ${priceStr} ${arrow} ${item.change24h.toFixed(2)}% | RSI: ${item.rsi}`
    }),
    ``,
    `🤖 _${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`,
  ]

  return lines.join('\n')
}

export async function sendWhatsApp(text: string): Promise<boolean> {
  try {
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
      {
        number: WHATSAPP_NUMBER,
        text,
      },
      {
        headers: {
          apikey: EVOLUTION_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    )
    console.log(`[WhatsApp] Mensagem enviada para ${WHATSAPP_NUMBER}`)
    return true
  } catch (err: any) {
    console.error('[WhatsApp] Erro ao enviar:', err?.response?.data ?? err.message)
    return false
  }
}

export async function sendBuyAlert(symbol: string, price: number, rsi: number): Promise<boolean> {
  const msg = buildBuyMessage(symbol, price, rsi)
  return sendWhatsApp(msg)
}

export async function sendSellAlert(symbol: string, price: number, rsi: number): Promise<boolean> {
  const msg = buildSellMessage(symbol, price, rsi)
  return sendWhatsApp(msg)
}

export async function sendSummary(
  items: Array<{ symbol: string; price: number; rsi: number; change24h: number; signal: string }>
): Promise<boolean> {
  const msg = buildSummaryMessage(items)
  return sendWhatsApp(msg)
}
