/**
 * kv-reader.js - 通过 Cloudflare Workers KV API 读取数据
 * 
 * 注意：由于 Pages Functions 不能直接访问 KV Namespace，需要通过外部 API
 * 这里使用 CF_API 端点来间接获取 KV 值（需要 API Token）
 */

const KV_API_URL = 'https://api.cloudflare.com/client/v4/accounts/' + 
                   (context.cloudflare?.env?.CF_ACCOUNT_ID || context.env?.CF_ACCOUNT_ID) +
                   '/storage/kv/namespaces/' + namespaceId + '/values';

export async function getKV(context, namespaceId) {
  const apiToken = context.env?.CF_PAGES_API_TOKEN || context.cloudflare?.env?.CF_PAGES_API_TOKEN;
  
  if (!apiToken) {
    return null;
  }

  try {
    // 使用 fetch 通过 API Token 获取 KV 数据
    const response = await fetch(KV_API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('KV API Error:', errorData);
      return null;
    }

    const data = await response.json();
    
    if (data.result && Array.isArray(data.result)) {
      // 将 KV 响应转换为对象格式
      const result = {};
      for (const item of data.result) {
        result[item.key] = item.value;
      }
      return result;
    }

    return null;

  } catch (error) {
    console.error('KV fetch error:', error);
    return null;
  }
}
