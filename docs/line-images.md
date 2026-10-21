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

## 异常货物登记按钮

服务器配置 `ESPOIRER_ACCESS_TOKEN`（仅 Token 部分，也兼容 `Bearer ` 前缀）。该凭据只保存在服务器环境变量中，不传给前端；过期后需更新。

部署前执行 `migrations/20261020_line_cargo.sql`。它新增 `line_cargo_registrations`，只保存编号和登记状态，不保存完整订单、收件人信息或凭据。

点击每条编号后的「登録」：
1. 新标签页打开该编号的配送订单详情；原网页保留以便显示处理状态。
2. 服务器查询订单详情，选择 createTime 最新的 orderTrackType=8 轨迹；没有轨迹、日期无效或缺少 failReason 时不登记。
3. failReason → issue，remark → issueDetails（空值用空字符串），createTime 按日本时间转 YYYY-MM-DD → warehouseArrivalDate。returnStatus 固定「返品済」，project 固定 0，projectValue 使用该行编号。
4. 调用 cargoIssues/create，成功后新标签页转到异常货物页面；若浏览器拦截新窗口或跨站跳转，可点击行内「登録済」按钮。控制台页面使用浏览器原有登录状态，服务器 Token 不会自动登录浏览器。

同一编号通过本功能成功登记后显示「登録済」，不会再次提交。提交结果不明确（超时、连接中断等）显示「要確認」，请先在控制台确认，避免重复登记；服务器中断残留的 processing 状态也不会自动重发。需要恢复此类编号时，应在实际确认外部结果后由管理员将对应状态改为 registered（已成功）或 failed（确定没有登记），不要未经确认直接重试。这个保护只覆盖通过本功能发起的登记，也会在新增前调用 cargoIssues/list 检查其他系统或手工登记的旧记录，已存在则直接跳过新增。

测试：`node --test tests/line-cargo.test.mjs tests/line-cargo-api.test.mjs`。测试中的新增请求使用模拟接口，不会创建真实业务记录。

登记前先按 hawbNos 查询 cargoIssues/list；查询失败或结果格式异常时停止新增。查到相同编号则同步显示「登録済」，不重复新增。登记成功后的跳转以及「登録済」按钮都带该行编号和 searchDateType、searchTimeType、searchType 参数。每行只保留一个按钮：「登録」执行登记，「登録済」打开筛选后的异常货物页面，「要確認」打开同一页面供人工确认。

## 页面自动登记

「更新」右侧的「自動登録：OFF／ON」控制本页面的自动登记。默认 OFF，刷新、离开或关闭页面后恢复 OFF；保持页面打开且为 ON 时，按设定间隔独立查询开启之后识别完成的新编号，搜索条件和当前分页不会限制自动处理范围。不会批量补登开启之前的旧编号。自动登记逐条执行，不弹出控制台窗口；仍先查外部记录，已存在的跳过新增。

关闭开关会清空尚未开始的任务，已提交的一条会完成；失败或结果不明确的编号不会循环自动重试，页面会显示错误以便手动确认。浏览器后台节流或断网可能延迟轮询，恢复后会继续查找当前 ON 时段内的编号。

部署前执行 `migrations/20261020_line_auto_registration.sql`，它为文字记录增加 `recognized_at` 识别完成时间及索引。该时间用于区分开启前后完成识别的记录，表格的「受信日時」仍显示原 LINE 消息时间。

轮询间隔通过「更新間隔（秒）」输入并点击「適用」设置，允许 5～3600 的整数秒，默认 5 秒；页面刷新与自动登记共用该间隔。修改间隔不会重建自动登记队列或清除去重状态；重新打开页面恢复默认值。

页面的「自動更新：OFF／ON」默认 OFF，控制表格定时刷新；OFF 时隐藏间隔输入和适用按钮，ON 时显示。更新、自动更新与自动登记按钮位于搜索框下方第二行。自动登记开关独立控制，自动更新 OFF 不会停止已经开启的自动登记；两者仍使用同一间隔设置。手动更新、搜索、分页与排序不受自动更新开关限制。
