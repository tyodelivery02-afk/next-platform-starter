import { google } from 'googleapis';

// 简单的内存缓存
let cache = {
    data: null,
    timestamp: null,
    ttl: 60000 // 缓存1分钟
};

export async function GET(request) {
    try {
        // 检查缓存
        const now = Date.now();
        if (cache.data && cache.timestamp && (now - cache.timestamp < cache.ttl)) {
            console.log('Returning cached data');
            return Response.json({
                success: true,
                data: cache.data,
                totalRecords: cache.data.length,
                cached: true
            });
        }

        const SPREADSHEET_ID = '1FE-9JKnp_whUaK8TE7YKjPVnqM5zInarJK26uW8rmTE';

        // 设置Google Sheets API认证
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 获取所有sheet名称
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        // 筛选出不包含【シート】的sheet
        const validSheets = spreadsheet.data.sheets
            .map(sheet => sheet.properties.title)
            .filter(title => !title.includes('シート'));

        console.log('Valid sheets:', validSheets);

        // 从所有有效的sheet中获取数据
        const allData = [];

        // 使用batchGet一次性获取所有sheet的数据，减少API调用次数
        const ranges = validSheets.map(sheetName => `${sheetName}!A3:H`);

        const batchResponse = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ranges,
        });

        // 处理批量响应
        batchResponse.data.valueRanges.forEach((valueRange) => {
            const rows = valueRange.values || [];

            rows.forEach(row => {
                if (row.length > 0 && row[0]) { // 确保至少有配送業者数据
                    allData.push({
                        配送業者: row[0] || '',
                        担当: row[1] || '',
                        HOUSE番号: row[2] || '',
                        TicketNo: row[3] || '',
                        理由: row[4] || '',
                        結果: row[5] || '',
                        記入時間: row[6] || '',
                        記入者: row[7] || '',
                    });
                }
            });
        });

        // 更新缓存
        cache.data = allData;
        cache.timestamp = now;

        console.log(`Fetched ${allData.length} records from Google Sheets`);

        return Response.json({
            success: true,
            data: allData,
            totalRecords: allData.length,
            cached: false
        });

    } catch (error) {
        console.error('Error fetching Google Sheets data:', error);

        // 如果是配额错误，返回缓存的数据（如果有）
        if (error.code === 429 && cache.data) {
            console.log('Quota exceeded, returning cached data');
            return Response.json({
                success: true,
                data: cache.data,
                totalRecords: cache.data.length,
                cached: true,
                warning: 'Using cached data due to quota limit'
            });
        }

        return Response.json(
            {
                success: false,
                error: error.message,
                code: error.code
            },
            { status: error.code === 429 ? 429 : 500 }
        );
    }
}