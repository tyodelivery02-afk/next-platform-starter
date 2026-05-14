import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";
import crypto from "crypto";
import { KEYWORDS } from "app/config/config";

const sql = neon();

function hash(text) {
    return crypto.createHash("sha256").update(text).digest("hex");
}

// ===== Twitter =====
async function collectTwitter(keyword) {
    const url =
        `https://api.twitter.com/2/tweets/search/recent` +
        `?query=${encodeURIComponent(keyword)} -is:retweet` +
        `&tweet.fields=created_at,author_id&max_results=10`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
    });

    if (!res.ok) {
        const text = await res.text();

        if (res.status === 429) {
            return {
                success: false,
                error: "Twitter API 请求限制，请稍后再试",
                code: 429
            };
        }

        throw new Error(`Twitter API ${res.status}: ${text}`);
    }

    const json = await res.json();
    if (!json.data || json.data.length === 0) {
        return { success: true, count: 0 };
    }

    let insertedCount = 0;
    for (const t of json.data) {
        const id = `tw_${t.id}`;
        try {
            const result = await sql`
                INSERT INTO monitored_items
                (id, source, keyword, content, published_at, url)
                VALUES (
                    ${id},
                    'twitter',
                    ${keyword},
                    ${t.text},
                    ${t.created_at},
                    ${`https://x.com/i/web/status/${t.id}`}
                )
                ON CONFLICT (url) DO NOTHING
                RETURNING id
            `;
            if (result.length > 0) insertedCount++;
        } catch (e) {
            console.error(`插入 Twitter 数据失敗 (${id}):`, e.message);
        }
    }

    return { success: true, count: insertedCount };
}

// ===== Bluesky =====
async function collectBluesky(keyword) {
    try {
        const url =
            `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts` +
            `?q=${encodeURIComponent(keyword)}` +
            `&limit=20`;

        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            return {
                success: false,
                error: `Bluesky API ${res.status}`
            };
        }

        const data = await res.json();
        const posts = data.posts || [];

        console.log(`Bluesky 找到 ${posts.length} 条结果`);

        let insertedCount = 0;

        for (const post of posts) {
            const text = post.record?.text || '';
            const createdAt = post.record?.createdAt || post.indexedAt || null;
            const handle = post.author?.handle;
            const uri = post.uri;

            if (!uri || !handle) continue;

            const rkey = uri.split('/').pop();
            const postUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;
            const id = `bsky_${hash(postUrl)}`;

            try {
                const result = await sql`
                    INSERT INTO monitored_items
                    (id, source, keyword, content, url, published_at)
                    VALUES (
                        ${id},
                        'bluesky',
                        ${keyword},
                        ${text},
                        ${postUrl},
                        ${createdAt ? new Date(createdAt) : null}
                    )
                    ON CONFLICT (url) DO NOTHING
                    RETURNING id
                `;

                if (result.length > 0) insertedCount++;
            } catch (e) {
                console.error(`插入 Bluesky 数据失敗 (${id}):`, e.message);
            }
        }

        return {
            success: true,
            count: insertedCount,
            total: posts.length
        };
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

// ===== YouTube =====
async function collectYouTube(keyword) {
    try {
        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

        if (!YOUTUBE_API_KEY) {
            console.log('YouTube API 未配置，跳过');
            return {
                success: false,
                error: "YouTube API 未配置"
            };
        }

        const url =
            `https://www.googleapis.com/youtube/v3/search` +
            `?part=snippet` +
            `&q=${encodeURIComponent(keyword)}` +
            `&type=video` +
            `&order=date` +
            `&maxResults=20` +
            `&regionCode=JP` +
            `&relevanceLanguage=ja` +
            `&key=${YOUTUBE_API_KEY}`;

        const res = await fetch(url);

        if (!res.ok) {
            const text = await res.text();
            return {
                success: false,
                error: `YouTube API ${res.status}: ${text}`
            };
        }

        const data = await res.json();
        const items = data.items || [];

        console.log(`YouTube 找到 ${items.length} 条结果`);

        let insertedCount = 0;

        for (const item of items) {
            const videoId = item.id?.videoId;
            const snippet = item.snippet;

            if (!videoId || !snippet) continue;

            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const id = `youtube_${videoId}`;

            try {
                const result = await sql`
                    INSERT INTO monitored_items
                    (id, source, keyword, title, content, url, published_at)
                    VALUES (
                        ${id},
                        'youtube',
                        ${keyword},
                        ${snippet.title || ''},
                        ${snippet.description || ''},
                        ${videoUrl},
                        ${snippet.publishedAt ? new Date(snippet.publishedAt) : null}
                    )
                    ON CONFLICT (url) DO NOTHING
                    RETURNING id
                `;

                if (result.length > 0) insertedCount++;
            } catch (e) {
                console.error(`插入 YouTube 数据失敗 (${id}):`, e.message);
            }
        }

        return {
            success: true,
            count: insertedCount,
            total: items.length
        };
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

// ===== 通用 Google 搜索 =====
async function collectGoogleSearch(keyword) {
    try {
        // 使用 Google Custom Search API 或 Programmable Search Engine
        const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
        const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX; // Custom Search Engine ID

        if (!GOOGLE_API_KEY || !GOOGLE_CX) {
            console.log('Google Search API 未配置，跳过');
            return { success: false, error: "Google Search API 未配置" };
        }

        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(keyword)}&num=10`;

        const res = await fetch(url);

        if (!res.ok) {
            return { success: false, error: `Google Search API ${res.status}` };
        }

        const data = await res.json();
        const items = data.items || [];

        console.log(`Google 搜索找到 ${items.length} 条结果`);

        let insertedCount = 0;
        for (const item of items) {
            const id = `google_${hash(item.link)}`;

            try {
                const result = await sql`
                    INSERT INTO monitored_items
                    (id, source, keyword, title, content, url, published_at)
                    VALUES (
                        ${id},
                        'google-search',
                        ${keyword},
                        ${item.title},
                        ${item.snippet || ''},
                        ${item.link},
                        ${new Date()}
                    )
                    ON CONFLICT (url) DO NOTHING
                    RETURNING id
                `;
                if (result.length > 0) insertedCount++;
            } catch (e) {
                console.error(`插入 Google Search 数据失敗:`, e.message);
            }
        }

        return { success: true, count: insertedCount, total: items.length };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ===== SerpAPI =====
async function collectSerpAPI(keyword) {
    try {
        const SERPAPI_KEY = process.env.SERPAPI_KEY;

        if (!SERPAPI_KEY) {
            console.log('SerpAPI 未配置，跳过');
            return { success: false, error: "SerpAPI 未配置" };
        }

        // SerpAPI - 提供真实的 Google 搜索结果
        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&api_key=${SERPAPI_KEY}&num=20`;

        const res = await fetch(url);

        if (!res.ok) {
            return { success: false, error: `SerpAPI ${res.status}` };
        }

        const data = await res.json();
        const results = data.organic_results || [];

        console.log(`SerpAPI 找到 ${results.length} 条结果`);

        let insertedCount = 0;
        for (const item of results) {
            const id = `serp_${hash(item.link)}`;

            try {
                const result = await sql`
                    INSERT INTO monitored_items
                    (id, source, keyword, title, content, url, published_at)
                    VALUES (
                        ${id},
                        'google-search',
                        ${keyword},
                        ${item.title},
                        ${item.snippet || ''},
                        ${item.link},
                        ${new Date()}
                    )
                    ON CONFLICT (url) DO NOTHING
                    RETURNING id
                `;
                if (result.length > 0) insertedCount++;
            } catch (e) {
                console.error(`插入 SerpAPI 数据失敗:`, e.message);
            }
        }

        return { success: true, count: insertedCount, total: results.length };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ===== Yahoo! Japan News =====
async function collectYahooJapanNews(keyword) {
    try {
        // Yahoo! Japan News RSS
        const rssUrl = `https://news.yahoo.co.jp/rss/topics/top-picks.xml`;

        const res = await fetch(rssUrl);
        if (!res.ok) {
            return { success: false, error: `Yahoo Japan RSS ${res.status}` };
        }

        const xml = await res.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

        // 过滤包含关键词的新闻
        let insertedCount = 0;
        for (const item of items) {
            const title = item[1].match(/<title>(.*?)<\/title>/)?.[1];
            const link = item[1].match(/<link>(.*?)<\/link>/)?.[1];
            const pubDate = item[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
            const description = item[1].match(/<description>(.*?)<\/description>/)?.[1];

            if (!title || !link) continue;

            // 检查标题或描述是否包含关键词
            const fullText = `${title} ${description || ''}`;
            if (!fullText.toLowerCase().includes(keyword.toLowerCase())) continue;

            const id = `yahoo_${hash(link)}`;

            try {
                const result = await sql`
                    INSERT INTO monitored_items
                    (id, source, keyword, title, content, url, published_at)
                    VALUES (
                        ${id},
                        'yahoo-japan',
                        ${keyword},
                        ${title},
                        ${description || ''},
                        ${link},
                        ${pubDate ? new Date(pubDate) : null}
                    )
                    ON CONFLICT (url) DO NOTHING
                    RETURNING id
                `;
                if (result.length > 0) insertedCount++;
            } catch (e) {
                console.error(`插入 Yahoo Japan 数据失敗:`, e.message);
            }
        }

        return { success: true, count: insertedCount };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ===== Google News Japan =====
async function collectGoogleNewsJapan(keyword) {
    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`;

        console.log(`📰 搜索日本新闻: ${keyword}`);

        const res = await fetch(rssUrl);
        if (!res.ok) {
            return { success: false, error: `Google News Japan ${res.status}` };
        }

        const xml = await res.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

        console.log(`找到 ${items.length} 条日本新闻`);

        let insertedCount = 0;
        for (const item of items) {
            const title = item[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1];
            const link = item[1].match(/<link>(.*?)<\/link>/)?.[1];
            const pubDate = item[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1];

            if (!title || !link) continue;

            const id = `gnews_jp_${hash(link)}`;

            try {
                const result = await sql`
                    INSERT INTO monitored_items
                    (id, source, keyword, title, url, published_at)
                    VALUES (
                        ${id},
                        'google-news-jp',
                        ${keyword},
                        ${title},
                        ${link},
                        ${pubDate ? new Date(pubDate) : null}
                    )
                    ON CONFLICT (url) DO NOTHING
                    RETURNING id
                `;
                if (result.length > 0) insertedCount++;
            } catch (e) {
                console.error(`插入 Google News Japan 数据失敗:`, e.message);
            }
        }

        return { success: true, count: insertedCount };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ===== 5ch =====
async function collect5ch(keyword) {
    try {
        const url = `https://ff5ch.syoboi.jp/?q=${encodeURIComponent(keyword)}`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            },
            cache: 'no-store'
        });

        if (!res.ok) {
            return {
                success: false,
                error: `5ch 搜索失败 ${res.status}`
            };
        }

        const html = await res.text();

        // 提取 5ch.io 的线程链接
        const threadMatches = [
            ...html.matchAll(
                /<a[^>]+href="(https?:\/\/[^"]+?\.5ch\.io\/test\/read\.cgi\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
            )
        ];

        let insertedCount = 0;

        for (const match of threadMatches.slice(0, 10)) {
            const threadUrl = match[1];

            const title = match[2]
                .replace(/<[^>]*>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .trim();

            if (!threadUrl || !title) continue;

            const id = `5ch_${hash(threadUrl)}`;

            try {
                const result = await sql`
                    INSERT INTO monitored_items
                    (id, source, keyword, title, url, published_at)
                    VALUES (
                        ${id},
                        '5ch',
                        ${keyword},
                        ${title},
                        ${threadUrl},
                        ${new Date()}
                    )
                    ON CONFLICT (url) DO NOTHING
                    RETURNING id
                `;

                if (result.length > 0) insertedCount++;
            } catch (e) {
                console.error(`插入 5ch 数据失败:`, e.message);
            }
        }

        return {
            success: true,
            count: insertedCount,
            total: threadMatches.length
        };
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

// ===== note =====
async function collectNote(keyword) {
    try {
        // note 的搜索页面
        const url = `https://note.com/search?context=note&q=${encodeURIComponent(keyword)}&sort=new`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });

        if (!res.ok) {
            return { success: false, error: `note 搜索失敗 ${res.status}` };
        }

        const html = await res.text();

        // 提取文章链接（简化版，实际可能需要更复杂的解析）
        const articleMatches = [...html.matchAll(/href="(\/[^"]+\/n\/[^"]+)"/g)];

        let insertedCount = 0;
        for (const match of articleMatches.slice(0, 20)) {
            const path = match[1];
            const fullUrl = `https://note.com${path}`;
            const id = `note_${hash(fullUrl)}`;

            try {
                const result = await sql`
                    INSERT INTO monitored_items
                    (id, source, keyword, url, published_at)
                    VALUES (
                        ${id},
                        'note',
                        ${keyword},
                        ${fullUrl},
                        ${new Date()}
                    )
                    ON CONFLICT (url) DO NOTHING
                    RETURNING id
                `;
                if (result.length > 0) insertedCount++;
            } catch (e) {
                console.error(`插入 note 数据失敗:`, e.message);
            }
        }

        return { success: true, count: insertedCount };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function POST(req) {
    const startTime = Date.now();

    // 验证请求来源
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers.get('x-vercel-cron');
    const isNetlifyCron = req.headers.get('x-netlify-scheduled');

    const triggeredBy = isVercelCron ? 'vercel-cron' :
        isNetlifyCron ? 'netlify-cron' :
            'manual';

    if (cronSecret && !isVercelCron && !isNetlifyCron) {
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
    }

    const results = {
        twitter: {},
        bluesky: {},
        youtube: {},
        googleSearch: {},
        googleNews: {},
        yahooJapan: {},
        bingSearch: {},
        fivech: {},
        note: {},
        errors: [],
        executedAt: new Date().toISOString()
    };

    try {
        for (const keyword of KEYWORDS) {
            console.log(`\n🔍 開始收集關鍵詞: ${keyword}`);

            // 通用 Google 搜索（优先，如果配置了）
            if (process.env.SERPAPI_KEY) {
                try {
                    const serpResult = await collectSerpAPI(keyword);
                    results.googleSearch[keyword] = serpResult;
                    if (!serpResult.success) {
                        results.errors.push({
                            source: 'google-search',
                            keyword,
                            error: serpResult.error
                        });
                    }
                } catch (e) {
                    console.error(`SerpAPI 收集失敗 (${keyword}):`, e);
                    results.googleSearch[keyword] = { success: false, error: e.message };
                    results.errors.push({ source: 'google-search', keyword, error: e.message });
                }
            } else if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
                try {
                    const googleResult = await collectGoogleSearch(keyword);
                    results.googleSearch[keyword] = googleResult;
                    if (!googleResult.success) {
                        results.errors.push({
                            source: 'google-search',
                            keyword,
                            error: googleResult.error
                        });
                    }
                } catch (e) {
                    console.error(`Google Search 收集失敗 (${keyword}):`, e);
                    results.googleSearch[keyword] = { success: false, error: e.message };
                    results.errors.push({ source: 'google-search', keyword, error: e.message });
                }
            }

            // Twitter
            try {
                const twitterResult = await collectTwitter(keyword);
                results.twitter[keyword] = twitterResult;
                if (!twitterResult.success) {
                    results.errors.push({
                        source: 'twitter',
                        keyword,
                        error: twitterResult.error
                    });
                }
            } catch (e) {
                console.error(`Twitter 收集失敗 (${keyword}):`, e);
                results.twitter[keyword] = { success: false, error: e.message };
                results.errors.push({ source: 'twitter', keyword, error: e.message });
            }

            // Bluesky
            try {
                const blueskyResult = await collectBluesky(keyword);
                results.bluesky[keyword] = blueskyResult;

                if (!blueskyResult.success) {
                    results.errors.push({
                        source: 'bluesky',
                        keyword,
                        error: blueskyResult.error
                    });
                }
            } catch (e) {
                console.error(`Bluesky 收集失敗 (${keyword}):`, e);
                results.bluesky[keyword] = {
                    success: false,
                    error: e.message
                };
                results.errors.push({
                    source: 'bluesky',
                    keyword,
                    error: e.message
                });
            }

            // YouTube
            try {
                const youtubeResult = await collectYouTube(keyword);
                results.youtube[keyword] = youtubeResult;

                if (!youtubeResult.success) {
                    results.errors.push({
                        source: 'youtube',
                        keyword,
                        error: youtubeResult.error
                    });
                }
            } catch (e) {
                console.error(`YouTube 收集失敗 (${keyword}):`, e);
                results.youtube[keyword] = {
                    success: false,
                    error: e.message
                };
                results.errors.push({
                    source: 'youtube',
                    keyword,
                    error: e.message
                });
            }

            // Google News Japan
            try {
                const newsResult = await collectGoogleNewsJapan(keyword);
                results.googleNews[keyword] = newsResult;
                if (!newsResult.success) {
                    results.errors.push({
                        source: 'google-news-jp',
                        keyword,
                        error: newsResult.error
                    });
                }
            } catch (e) {
                console.error(`Google News JP 收集失敗 (${keyword}):`, e);
                results.googleNews[keyword] = { success: false, error: e.message };
                results.errors.push({ source: 'google-news-jp', keyword, error: e.message });
            }

            // Yahoo Japan News
            try {
                const yahooResult = await collectYahooJapanNews(keyword);
                results.yahooJapan[keyword] = yahooResult;
                if (!yahooResult.success) {
                    results.errors.push({
                        source: 'yahoo-japan',
                        keyword,
                        error: yahooResult.error
                    });
                }
            } catch (e) {
                console.error(`Yahoo Japan 收集失敗 (${keyword}):`, e);
                results.yahooJapan[keyword] = { success: false, error: e.message };
                results.errors.push({ source: 'yahoo-japan', keyword, error: e.message });
            }

            // 5ch (2ch)
            try {
                const fivechResult = await collect5ch(keyword);
                results.fivech[keyword] = fivechResult;
                if (!fivechResult.success) {
                    results.errors.push({
                        source: '5ch',
                        keyword,
                        error: fivechResult.error
                    });
                }
            } catch (e) {
                console.error(`5ch 收集失敗 (${keyword}):`, e);
                results.fivech[keyword] = { success: false, error: e.message };
                results.errors.push({ source: '5ch', keyword, error: e.message });
            }

            // note
            try {
                const noteResult = await collectNote(keyword);
                results.note[keyword] = noteResult;
                if (!noteResult.success) {
                    results.errors.push({
                        source: 'note',
                        keyword,
                        error: noteResult.error
                    });
                }
            } catch (e) {
                console.error(`note 收集失敗 (${keyword}):`, e);
                results.note[keyword] = { success: false, error: e.message };
                results.errors.push({ source: 'note', keyword, error: e.message });
            }

            // 延迟避免请求过快
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 计算总数
        const googleSearchTotal = Object.values(results.googleSearch)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const bingSearchTotal = Object.values(results.bingSearch)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const twitterTotal = Object.values(results.twitter)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const blueskyTotal = Object.values(results.bluesky)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const youtubeTotal = Object.values(results.youtube)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const googleNewsTotal = Object.values(results.googleNews)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const yahooTotal = Object.values(results.yahooJapan)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const fivechTotal = Object.values(results.fivech)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const noteTotal = Object.values(results.note)
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.count || 0), 0);

        const duration = Date.now() - startTime;
        const totalCount =
            googleSearchTotal +
            bingSearchTotal +
            twitterTotal +
            blueskyTotal +
            youtubeTotal +
            googleNewsTotal +
            yahooTotal +
            fivechTotal +
            noteTotal;
        const status = results.errors.length === 0 ? 'success' :
            (totalCount > 0 ? 'partial' : 'failed');

        // 记录到日志表
        try {
            await sql`
                INSERT INTO cron_logs
                (status, twitter_count, news_count, total_count, errors, duration_ms, triggered_by)
                VALUES (
                    ${status},
                    ${twitterTotal},
                    ${googleSearchTotal + bingSearchTotal + blueskyTotal + youtubeTotal + googleNewsTotal + yahooTotal + fivechTotal + noteTotal},
                    ${totalCount},
                    ${JSON.stringify(results.errors)},
                    ${duration},
                    ${triggeredBy}
                )
            `;
        } catch (logError) {
            console.error('日志记录失敗:', logError);
        }

        return NextResponse.json({
            success: true,
            summary: {
                googleSearch: googleSearchTotal,
                bingSearch: bingSearchTotal,
                twitter: twitterTotal,
                bluesky: blueskyTotal,
                youtube: youtubeTotal,
                googleNews: googleNewsTotal,
                yahooJapan: yahooTotal,
                fivech: fivechTotal,
                note: noteTotal,
                total: totalCount
            },
            details: results,
            hasErrors: results.errors.length > 0,
            duration: `${duration}ms`
        });

    } catch (e) {
        const duration = Date.now() - startTime;

        try {
            await sql`
                INSERT INTO cron_logs
                (status, errors, duration_ms, triggered_by)
                VALUES (
                    'failed',
                    ${JSON.stringify([{ error: e.message }])},
                    ${duration},
                    ${triggeredBy}
                )
            `;
        } catch (logError) {
            console.error('日志记录失敗:', logError);
        }

        console.error("監控執行失敗:", e);
        return NextResponse.json(
            {
                success: false,
                error: e.message,
                details: results
            },
            { status: 500 }
        );
    }
}