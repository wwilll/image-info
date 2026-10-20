# 项目 AI 指令

## 项目性质
纯静态 HTML 项目，部署在 Cloudflare Pages 上。
没有构建步骤、没有包管理器、没有 node_modules。
本地开发直接用浏览器打开 index.html 即可。

## 硬性约束
- 禁止创建 package.json、node_modules、vite/webpack 等构建配置。
- 禁止引入需要 `npm install` 或需要编译的库。
- 第三方库只能通过 CDN 引入。优先使用 BootCDN，其次 jsDelivr / unpkg。
- 不要生成 `.ts`、`.jsx`、`.scss` 等需要编译的文件；只用 `.html`、`.css`、`.js`。

## 代码组织（保持克制）
- 逻辑简单时：CSS/JS 内联在 index.html 的 `<style>` / `<script>` 里。
- 逻辑较复杂时：允许根目录下用 `index.js` 承载主要逻辑，由 `index.html` 用 `<script src="./index.js">` 引入。
- 允许少量按职责拆分的 `.js` 文件（如 `storage.js`、`api.js`），但总数控制在 3~4 个以内，不要为每个函数建文件。
- 禁止引入 src/、lib/、utils/ 这种多层目录结构；所有 `.js` 平铺在根目录。
- 页面主逻辑仍建议保持简单，能用普通 `<script>` 解决的，不强行上 ESM。

## CDN 选择（按国内访问速度排序）
1. **BootCDN**（首选，国内节点多、延迟低）
   - 格式：`https://cdn.bootcdn.net/ajax/libs/<库名>/<版本>/<文件>`
   - 注意：老域名 `cdn.bootcss.com` 已失效，不要使用
2. **jsDelivr**（备选，部分国内节点）
   - 格式：`https://cdn.jsdelivr.net/npm/<包名>@<版本>/<路径>`
3. **unpkg**（最后考虑，国内速度通常较慢）
   - 格式：`https://unpkg.com/<包名>@<版本>/<路径>`

所有 CDN 引用必须带固定版本号，禁止使用 `latest`。

## ES Module 用法
- 如果库提供了 ESM 版本（如 `xxx.esm.js`），可以用 `<script type="module">` 引入。
- 也可以用 esm.sh 转换：`import xxx from 'https://esm.sh/<包名>@<版本>'`
- 本地自己的 `index.js` 若要用 ESM，需在 html 中用 `<script type="module" src="./index.js">`，并注意此时不能用普通 script 的全局变量方式互相访问。

## Cloudflare Pages 规则
### 静态资源限制
- 免费版单站点最多 20,000 个文件，单文件最大 25 MiB。
- 不要把大文件（视频、大型数据集）放进仓库，用 R2 或外部存储。

### Functions 规则
- 如果需要后端逻辑，在项目根目录创建 `functions/` 目录（不能放在静态输出目录里）。
- 文件名决定路由：`functions/hello.js` → `/hello`，`functions/api/[[path]].js` → `/api/*`。
- 每个 Function 必须导出 `onRequest`，返回 `Response` 或 `Promise<Response>`。
- Functions 运行在 Workers 运行时，支持 ES Module 导入，但只兼容部分 Node.js API。
- **不要试图在 Functions 里用 `fs`、`path` 等完整 Node 内置模块**，也不要假设有 `node_modules` 可读。

### 部署检查
- 改完后确认所有 CDN URL 可访问（BootCDN 优先）。
- 如果改了 `functions/` 下的文件，确认路由路径与前端请求一致。
- 没有 `npm test` 之类的命令，验证方式是用浏览器打开或访问部署后的 URL。