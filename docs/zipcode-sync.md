# 手动同步日本邮政邮编

地图「操作」栏的「郵便番号同期」启动任务。普通地址和事业所使用日本邮便官方全国 ZIP/CSV，不需要 API Key。没有定时任务，也不会因打开地图自动同步。

## 部署

- 执行 `migrations/20261106_zipcode_sync.sql`。本次开发已在当前项目数据库执行；新数据库仍需执行。
- Netlify Functions 环境需有 `NETLIFY_DATABASE_URL`（或 `NETLIFY_DATABASE_URL_UNPOOLED` / `DATABASE_URL`）。沿用现有数据库配置，不向浏览器提供连接信息。
- 随项目部署 `netlify/functions/zipcode-sync-background.mjs`。文件名的 `-background` 后缀启用最长 15 分钟后台执行；生产站点需支持 Netlify Background Functions。
- 本地通过 `netlify dev` 的公开端口访问，通常为 8888；仅 `next dev` 没有 Netlify 后台任务入口。
- 登录后，POST `/api/zipcode/sync` 启动，GET 同一路径查询状态。启动校验同源和现有登录会话。后台任务使用仅服务器可见的随机 run ID，并由数据库限制同一任务只执行一次。

## 数据与事务

普通地址使用 UTF-8 单行格式；事业所使用 Shift-JIS。保留 5 位自治体代码、7 位邮编的前导零；同一邮编的多个町域分别保留。下载限制 12 MiB，CSV 限制 80 MiB，并校验格式、区分值、47 都道府县覆盖、总行数和异常缩水。

每次点击下载两份文件，比较解压后 CSV 的 SHA-256。与最近成功版本一致则跳过导入。首次运行会全量比对。两份数据先通过临时表 COPY 批量导入、校验，再在同一事务中应用差异。不改动正式表名、索引和未变化记录的 ID；发生字段变化的记录计为删除旧行并新增新行，因此 ID 会变化。已确认当前两表没有外键引用。新增/移除数量包括这种字段变化，不能当作新增/废止邮编数量。

失败回滚两表，保留最近成功版本 hash。状态表仅一行，不长期积累源文件和任务历史。正在运行时拒绝重复启动；任务中断后超过 20 分钟允许重试。后台最多执行 15 分钟，数据库单条语句最多 120 秒。出现记录数下降超过 10% 等异常会中止，需人工检查后调整校验，不能直接绕过。

页面只在任务运行期间每 5 秒查询状态。同步完成后清除当前页邮编缓存并重新加载已打开的列表和统计；其他已打开的标签页需刷新页面。地图配色、保存版本及人口数据不变。

## 验证

- `node --test tests/zipcode-sync.test.mjs`
- 设置数据库环境后：`node scripts/check-zipcode-sync.mjs --migrate --dry-run`。正式邮编表不写入，临时表事务回滚。
- `node scripts/test-zipcode-sync-transaction.mjs`。使用会话临时表遮蔽正式表名，验证增删、同邮编多町域和失败回滚，不改正式表或序列。

官方来源：
- https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html
- https://www.post.japanpost.jp/service/search/zipcode/download/office/index-zip.html
