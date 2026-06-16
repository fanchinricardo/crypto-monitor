// src/index.ts
import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { apiRoutes } from './routes/api'
import { startMonitorJob } from './jobs/monitorJob'
import { prisma } from './lib/prisma'

const PORT = parseInt(process.env.PORT ?? '3000')

async function bootstrap() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  // Rotas
  await app.register(apiRoutes, { prefix: '/api' })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Server] ${signal} recebido — encerrando...`)
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Conecta banco
  await prisma.$connect()
  console.log('[DB] Conectado ao Nhost PostgreSQL')

  // Inicia servidor
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`[Server] Rodando na porta ${PORT}`)

  // Inicia job de monitoramento
  startMonitorJob()
}

bootstrap().catch(err => {
  console.error('[Bootstrap] Erro fatal:', err)
  process.exit(1)
})
