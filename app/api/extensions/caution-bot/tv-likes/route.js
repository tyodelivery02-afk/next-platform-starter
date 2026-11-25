import { neon } from '@netlify/neon';
import { NextResponse } from 'next/server';
import { cautionApiKeyError } from 'lib/caution-api-key.mjs';

export const dynamic = 'force-dynamic';
const channels = new Set(['h-Z0wCdD3dI','RIgiw5FP5Rc','x0CloLdk44g','JcD52D6lSow','-uooI2satIQ','BsZEOvS3qTM','ydYDqZQpim8','7AnfOS9Bmr0','EvsLqQS_80E','UXrk42u8tnw','l8WwqwfVv_M','-cTFcOqU_tE','M3HKLzjvKPc','ROboUHfPUrU','4QJEibrt9B8','fO9e9jnhYK8','I3sa2kiEpkA','HggWKlZv9yk','gXKuUyKt8mc','xXZqU5vnEug','OOT6YlOYgaU','DHUnz4dyb54','R8MRTG0pYdc','ub6TVvmQnhA','YOkt3sijzyM','vua5GtYnA4A','3N-G4VkKN8A']);
const json = (body,status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'}});

async function respond(request, work) {
  const denied = cautionApiKeyError(request);
  if (denied) return json({error:'いいねを利用できません。'},denied);
  try { return await work(neon()); }
  catch { return json({error:'いいねを読み書きできませんでした。'},503); }
}

export function GET(request) {
  return respond(request,async sql=>{
    const counts = await sql`SELECT video_id, count(*) AS count FROM caution_tv_likes GROUP BY video_id`;
    return json({likes:Object.fromEntries(counts.map(row=>[row.video_id,Number(row.count)]))});
  });
}

export function POST(request) {
  return respond(request,async sql=>{
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return json({error:'いいねのデータが不正です。'},400);
    const raw = await request.text();
    if (raw.length > 1024) return json({error:'いいねのデータが大きすぎます。'},413);
    let input;
    try { input = JSON.parse(raw); } catch {}
    const {videoId,voteId} = input ?? {};
    const candidate = typeof input?.voterAccountName === 'string' ? input.voterAccountName.trim() : '';
    const voterAccountName = candidate.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(candidate) ? candidate : null;
    if (!channels.has(videoId) || typeof voteId !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(voteId)) {
      return json({error:'いいねのデータが不正です。'},400);
    }
    if (voterAccountName) {
      try {
        await sql`INSERT INTO caution_tv_likes AS stored (vote_id,video_id,voter_account_name)
          VALUES (${voteId}::uuid,${videoId},${voterAccountName})
          ON CONFLICT (vote_id) DO UPDATE SET voter_account_name = EXCLUDED.voter_account_name
            WHERE stored.video_id = EXCLUDED.video_id AND stored.voter_account_name IS NULL`;
      } catch (error) {
        if (error.code !== '42703') throw error;
        await sql`INSERT INTO caution_tv_likes (vote_id,video_id)
          VALUES (${voteId}::uuid,${videoId}) ON CONFLICT (vote_id) DO NOTHING`;
      }
    } else {
      await sql`INSERT INTO caution_tv_likes (vote_id,video_id)
        VALUES (${voteId}::uuid,${videoId}) ON CONFLICT (vote_id) DO NOTHING`;
    }
    const [total] = await sql`SELECT count(*) AS count FROM caution_tv_likes WHERE video_id = ${videoId}`;
    return json({count:Number(total.count)});
  });
}
