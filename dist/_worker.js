// _worker.js - Pages 高级模式：统一接管路由，替代 functions/ 目录
//
// 路由：
//   GET    /api/env                         所有环境变量 + 绑定列表
//   GET    /api/env?keys=A,B                只返回指定变量
//   GET    /api/env?kv=NAME                 列出该 KV 的 keys
//   GET    /api/env?kv=NAME&key=xxx         读单个 key 的值和 metadata
//   GET    /api/env?kv=NAME&readAll=true    读前 20 个 key 的值
//   POST   /api/kv   body {name,key,value,ttl?}   写入
//   DELETE /api/kv?name=NAME&key=xxx              删除
//   其余路径 → 静态资源（env.ASSETS）

const MAX_READALL_KEYS = 20

// ---------- 工具 ----------

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// 名称含 KEY/TOKEN/SECRET/PASSWORD 的视为敏感变量，自动脱敏
function maskIfNeeded(name, value) {
  if (/(^|_)(API_?KEY|TOKEN|SECRET|PASSWORD)(_|$)/i.test(name)) {
    const s = String(value)
    return s.length > 6 ? s.slice(0, 3) + '***' + s.slice(-3) : '***'
  }
  return value
}

// 根据绑定对象的方法特征判断类型（KV 可写，用于和 ASSETS 等只读绑定区分）
function detectBindingType(v) {
  if (v == null) return 'unknown'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return 'var'
  if (typeof v !== 'object') return typeof v
  if (typeof v.getWithMetadata === 'function' && typeof v.put === 'function' && typeof v.delete === 'function') return 'KV'
  if (typeof v.prepare === 'function') return 'D1'
  if (typeof v.head === 'function' && typeof v.get === 'function' && typeof v.put === 'function') return 'R2'
  if (typeof v.fetch === 'function') return 'service'
  return 'unknown'
}

function listBindings(env) {
  return Object.keys(env)
    .filter((name) => name !== 'ASSETS')
    .map((name) => ({ name, type: detectBindingType(env[name]) }))
}

// 取 KV 绑定；不存在或不是 KV 时返回 404 Response
function resolveKv(env, name) {
  const binding = name ? env[name] : null
  if (!binding || detectBindingType(binding) !== 'KV') {
    return {
      error: json({
        error: `KV binding "${name}" not found`,
        hint: '在 Dashboard → Pages → Settings → Bindings 添加 KV 绑定后需重新部署',
        availableKvBindings: listBindings(env).filter((b) => b.type === 'KV').map((b) => b.name),
      }, 404),
    }
  }
  return { binding }
}

// ---------- 处理器 ----------

// GET /api/env：环境变量 + KV 读取
async function handleEnv(request, env, url) {
  const params = url.searchParams
  const bindings = listBindings(env)

  // ---- KV 读取 ----
  const kvName = params.get('kv')
  if (kvName) {
    const { binding, error } = resolveKv(env, kvName)
    if (error) return error

    const key = params.get('key')
    if (key) {
      const { value, metadata } = await binding.getWithMetadata(key, { type: 'text' })
      return json({ kv: { name: kvName, key, value, metadata }, bindings })
    }

    const list = await binding.list({ limit: 100 })
    const keys = (list.keys || []).map((k) => ({
      name: k.name,
      expiration: k.expiration || null,
      metadata: k.metadata || null,
    }))

    if (params.get('readAll') === 'true') {
      const entries = {}
      for (const k of keys.slice(0, MAX_READALL_KEYS)) {
        entries[k.name] = await binding.get(k.name, { type: 'text' })
      }
      return json({
        kv: { name: kvName, keys, entries, truncated: keys.length > MAX_READALL_KEYS, list_complete: list.list_complete },
        bindings,
      })
    }

    return json({
      kv: { name: kvName, keys, list_complete: list.list_complete, hint: '加 &key=xxx 读单个值，&readAll=true 读前 20 个值' },
      bindings,
    })
  }

  // ---- 环境变量 ----
  const wanted = params.get('keys')
    ? params.getAll('keys').flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean)
    : Object.keys(env)
  const result = {}
  for (const name of wanted) {
    const v = env[name]
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      result[name] = maskIfNeeded(name, v)
    }
  }
  return json({ env: result, bindings })
}

// POST /api/kv 写入；DELETE /api/kv 删除
async function handleKv(request, env, url) {
  // POST 走 JSON body，DELETE 走 query
  const { name, key, value, ttl } = request.method === 'POST'
    ? await request.json().catch(() => ({}))
    : Object.fromEntries(url.searchParams)

  if (!name || !key) return json({ error: '缺少 name（KV 绑定名）或 key 参数' }, 400)

  const { binding, error } = resolveKv(env, name)
  if (error) return error

  if (request.method === 'DELETE') {
    await binding.delete(key)
    return json({ message: '删除成功', name, key })
  }

  if (typeof value !== 'string' || value === '') {
    return json({ error: '缺少 value（要写入的非空字符串）' }, 400)
  }
  const options = {}
  if (ttl != null) {
    const t = Number(ttl)
    if (!Number.isInteger(t) || t < 60) {
      return json({ error: 'ttl 必须是 >= 60 的整数（秒），KV 最低有效期 60s' }, 400)
    }
    options.expirationTtl = t
  }
  await binding.put(key, value, options)
  return json({ message: '写入成功', name, key, value, ttl: options.expirationTtl || null })
}

// ---------- 路由表 ----------

const routes = {
  'GET /api/env': handleEnv,
  'POST /api/kv': handleKv,
  'DELETE /api/kv': handleKv,
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const handler = routes[`${request.method} ${url.pathname}`]

    if (!handler) {
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404)
      return env.ASSETS.fetch(request)
    }

    try {
      return await handler(request, env, url)
    } catch (err) {
      return json({ error: '请求处理失败', message: String((err && err.message) || err) }, 500)
    }
  },
}
