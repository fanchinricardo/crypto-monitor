// src/services/priceService.ts
import axios from 'axios'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

// Mapeamento símbolo -> id do CoinGecko
const COIN_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
}

export interface PriceData {
  symbol: string
  price: number
  volume24h: number
  change24h: number
}

export interface OHLCData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

// Busca preço atual de BTC, ETH, SOL de uma vez
export async function fetchCurrentPrices(symbols: string[]): Promise<PriceData[]> {
  const ids = symbols.map(s => COIN_IDS[s]).filter(Boolean).join(',')

  const { data } = await axios.get(`${COINGECKO_BASE}/simple/price`, {
    params: {
      ids,
      vs_currencies: 'usd',
      include_24hr_vol: true,
      include_24hr_change: true,
    },
    timeout: 10000,
  })

  return symbols.map(symbol => {
    const id = COIN_IDS[symbol]
    const d = data[id]
    return {
      symbol,
      price: d?.usd ?? 0,
      volume24h: d?.usd_24h_vol ?? 0,
      change24h: d?.usd_24h_change ?? 0,
    }
  })
}

// Busca histórico de closes para calcular RSI (últimos 14 dias, intervalo diário)
export async function fetchClosePrices(symbol: string, days = 30): Promise<number[]> {
  const id = COIN_IDS[symbol]
  if (!id) throw new Error(`Símbolo desconhecido: ${symbol}`)

  const { data } = await axios.get(`${COINGECKO_BASE}/coins/${id}/market_chart`, {
    params: {
      vs_currency: 'usd',
      days,
      interval: 'daily',
    },
    timeout: 15000,
  })

  // data.prices = [[timestamp, price], ...]
  return (data.prices as [number, number][]).map(([, price]) => price)
}
