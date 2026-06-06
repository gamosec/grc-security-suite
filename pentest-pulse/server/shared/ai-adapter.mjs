/**
 * ai-adapter.mjs
 * ==============
 * A drop-in, Cloudflare-Workers-AI-compatible AI binding.
 *
 * The application code calls:
 *
 *     const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
 *       messages: [...],
 *       max_tokens: 2048,
 *       temperature: 0.3,
 *     })
 *     // expects: res.response  (a string)
 *
 * This adapter implements the same `.run()` method on top of one of several
 * providers, selected with the AI_PROVIDER environment variable:
 *
 *   AI_PROVIDER=ollama   (default) -> local Ollama server (on-prem, no keys)
 *   AI_PROVIDER=openai             -> OpenAI / Azure OpenAI compatible API
 *   AI_PROVIDER=none               -> returns a helpful stub message
 *
 * Model name mapping: Cloudflare model ids (e.g. '@cf/meta/llama-3.1-8b-instruct')
 * are mapped to the equivalent provider model via AI_MODEL / AI_MODEL_MAP.
 */

const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

/** Map a Cloudflare Workers AI model id to the configured provider model. */
function resolveModel(cfModel, provider) {
  // Allow a full override regardless of which CF model was requested.
  if (process.env.AI_MODEL) return process.env.AI_MODEL

  if (provider === 'ollama') return DEFAULT_OLLAMA_MODEL
  if (provider === 'openai') return DEFAULT_OPENAI_MODEL
  return cfModel
}

// --------------------------------------------------------------------------- //
// Providers
// --------------------------------------------------------------------------- //

async function runOllama(model, options) {
  const base = process.env.OLLAMA_URL || 'http://ollama:11434'
  const body = {
    model,
    messages: options.messages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.3,
      // Ollama uses num_predict for max tokens
      num_predict: options.max_tokens ?? 2048,
    },
  }

  const resp = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Ollama error ${resp.status}: ${text}`)
  }

  const data = await resp.json()
  // Ollama /api/chat returns { message: { role, content }, ... }
  const content = data?.message?.content ?? ''
  return { response: content, raw: data }
}

async function runOpenAI(model, options) {
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      max_tokens: options.max_tokens ?? 2048,
      temperature: options.temperature ?? 0.3,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`OpenAI error ${resp.status}: ${text}`)
  }

  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content ?? ''
  return { response: content, raw: data }
}

function runStub() {
  return {
    response:
      '🔧 AI features are disabled. Set AI_PROVIDER=ollama (and pull a model) ' +
      'or AI_PROVIDER=openai with OPENAI_API_KEY to enable the AI co-pilot.',
    stub: true,
  }
}

// --------------------------------------------------------------------------- //
// Factory
// --------------------------------------------------------------------------- //

/**
 * Returns an object with a `.run(model, options)` method compatible with the
 * Cloudflare Workers AI binding used throughout the codebase.
 */
export function createAIAdapter() {
  const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase()

  return {
    provider,
    async run(cfModel, options = {}) {
      const model = resolveModel(cfModel, provider)
      try {
        if (provider === 'ollama') return await runOllama(model, options)
        if (provider === 'openai' || provider === 'azure') {
          return await runOpenAI(model, options)
        }
        if (provider === 'none' || provider === 'off') return runStub()
        // Unknown provider -> stub with a hint
        return runStub()
      } catch (err) {
        // Surface a friendly error in the same shape the apps expect.
        // eslint-disable-next-line no-console
        console.error('[ai-adapter] run failed:', err.message)
        throw err
      }
    },
  }
}
