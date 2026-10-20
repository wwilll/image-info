// functions/api.js - Cloudflare Pages Functions: 读取环境变量和 KV
// 访问路径：/api/env

import { getKV } from './kv-reader.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // 只允许 GET 请求
  if (context.request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 获取 Cloudflare API Token（从环境变量）
    const apiToken = context.env?.CF_PAGES_API_TOKEN || context.cloudflare?.env?.CF_PAGES_API_TOKEN;
    
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: 'API token not configured', help: '请设置 CF_PAGES_API_TOKEN 环境变量' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取所有环境变量（从 context.env）
    const env = context.cloudflare?.env || {};
    
    let keysToReturn = [];
    
    if (url.searchParams.has('keys')) {
      keysToReturn = url.searchParams.getAll('keys');
    } else if (url.searchParams.has('all')) {
      // 获取所有环境变量名（包括 CF_ 开头的）
      keysToReturn = Object.keys(env).filter(k => k.startsWith('CF_') || k.includes('_KEY') || k.includes('_TOKEN'));
    }

    const result = {};

    for (const key of keysToReturn) {
      if (!env[key]) continue;

      let value = env[key];
      
      // 敏感字段脱敏
      if (/^(api_key|secret|password|token)/i.test(key)) {
        value = '***' + String(value).slice(-3);
      }

      result[key] = value;
    }

    // 如果请求了 KV 数据
    let kvData = {};
    const kvNamespaceId = url.searchParams.get('kv_id');
    
    if (kvNamespaceId) {
      kvData = await getKV(context, kvNamespaceId);
    }

    return new Response(JSON.stringify({ 
      env: result,
      ...(kvData ? { kv: kvData } : {})
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
