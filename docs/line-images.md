# LINE 图片编号识别

- 网页：`/line-images`（沿用网站登录）
- LINE Webhook：`https://你的域名/api/line/webhook`
- 编号：E 开头共 12 位英数字，例如 E20055855101。同一图片内去重；不同图片再次出现同一编号会保留各自的收信记录。
- OCR：使用现有 Gemini API，默认 `gemini-2.5-flash`，可用 `LINE_OCR_MODEL` 独立覆盖。

## 配置

在 `.env.local` 及部署平台的环境变量中配置：

```dotenv
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
GEMINI_API_KEY=
# 可选
LINE_OCR_MODEL=gemini-2.5-flash
```

数据库使用项目现有 `NETLIFY_DATABASE_URL`。首次运行执行 `migrations/20261020_line_ocr.sql`。

在 LINE Developers 的 Messaging API 设置中填写 Webhook URL，开启 Use webhook、Webhook redelivery 和 Allow bot to join group chats，再把机器人加入目标群聊。点击 Verify 时空 events 会返回成功。群聊中发送新图片后等待识别，网页每 5 秒刷新。机器人不向群聊自动发送回复。加入之前的历史图片不能回溯读取。

## 保存与处理

图片只通过 LINE 内容接口读入服务器内存，临时发送给 Gemini 做 OCR。不写数据库、文件系统、对象存储或日志，也不调用 Gemini Files API。数据库只保存提取的编号，以及去重所需事件 ID、收信时间、临时处理租约/状态。不保存图片、图片 URL、图片消息 ID、群组 ID、用户 ID 或整段 OCR 原文。

Webhook 校验原始请求体 HMAC 签名。处理成功才返回 200；暂时失败返回 503，以便 LINE 在开启 redelivery 后重投。重复事件用数据库唯一键及租约避免重复入库。没有匹配编号也会标记事件完成。单张图片最大 10 MiB，每次最多提取 200 个编号，OCR 不猜测模糊字符，识别准确性仍取决于图片清晰度。

部署环境须支持 Node.js、至少 60 秒函数执行时间。图片处理请求的总期限为 45 秒；批次未完成时返回失败，已完成的事件在重投中跳过。不要关闭 LINE 的 redelivery。首次识别延迟来自 LINE 下载与 OCR 请求，网页轮询另有最多约 5 秒延迟。

测试：`node --test tests/line-ocr.test.mjs`。
