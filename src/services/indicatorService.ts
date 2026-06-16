// src/services/indicatorService.ts

export interface RSIResult {
  value: number
  signal: 'buy' | 'sell' | 'hold'
  description: string
}

// Calcula RSI clássico de Wilder (14 períodos)
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) {
    throw new Error(`Precisamos de pelo menos ${period + 1} candles para calcular o RSI`)
  }

  // Primeira média simples
  let gains = 0
  let losses = 0

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  // Suavização de Wilder para os candles restantes
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100

  const rs = avgGain / avgLoss
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2))
}

export function interpretRSI(
  rsi: number,
  buyThreshold: number,
  sellThreshold: number
): RSIResult {
  if (rsi <= buyThreshold) {
    return {
      value: rsi,
      signal: 'buy',
      description: `RSI em ${rsi} — zona de sobrevenda (abaixo de ${buyThreshold}). Possível reversão de alta.`,
    }
  }

  if (rsi >= sellThreshold) {
    return {
      value: rsi,
      signal: 'sell',
      description: `RSI em ${rsi} — zona de sobrecompra (acima de ${sellThreshold}). Possível correção.`,
    }
  }

  return {
    value: rsi,
    signal: 'hold',
    description: `RSI em ${rsi} — zona neutra. Sem sinal claro.`,
  }
}
