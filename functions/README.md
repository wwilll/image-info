# Cloudflare Functions - 环境变量和 KV 读取器

## 部署说明

将 `functions/` 目录下的所有文件提交到 Git，然后 Push 到你的 Pages 仓库：

```bash
git add functions/api.js functions/kv-reader.js
git commit -m "Add CF env & KV reader"
git push origin main
```

## 配置环境变量（必需！）

在 Cloudflare Dashboard → **Settings** → **Environment variables** 中添加：

### 1. CF_PAGES_API_TOKEN (必填)

访问 Token: `https://dash.cloudflare.com/profile/api-tokens`  
选择模板：**Account Storage and KV - Read Only**  
API Token: 复制生成的 token，粘贴到环境变量值中

### 2. CF_ACCOUNT_ID (可选，自动获取)

通常不需要手动设置，Pages Functions 会自动包含 Account ID。

## 访问地址

- **环境变量**: `https://your-site.pages.dev/api/env`
- **KV 数据**: `https://your-site.pages.dev/api/env?kv_id=abc123...`

## 使用示例

```bash
# 获取所有环境变量（推荐用于测试）
curl "https://your-site.pages.dev/api/env" -H "Authorization: Bearer YOUR_TOKEN"

# 获取指定变量
curl "https://your-site.pages.dev/api/env?keys=API_KEY,SECRET,PREFIX_URL" \
     -H "Authorization: Bearer YOUR_TOKEN"

# 读取 KV Namespace
curl "https://your-site.pages.dev/api/env?kv_id=abc123xyz456..." \
     -H "Authorization: Bearer YOUR_TOKEN"
```

## 测试工具

访问：`/test.html` 或使用 curl 命令。

## 安全提示

⚠️ **重要**：
- `/api/env?all=true` 会暴露所有环境变量，生产环境慎用
- 建议只允许特定 `keys` 参数，例如：`/api/env?keys=API_KEY,PREFIX_URL`
- API Token 需要定期轮换（Cloudflare 支持）

## API Token 权限要求

Token 必须拥有以下权限：
- ✅ **Account Storage (KV)** - Read
- ❌ 不需要写入或删除权限

---

更多 Cloudflare Workers Functions 文档: https://developers.cloudflare.com/pages/functions/
