import { adminReleaseResponse, releaseStore } from '../../../../../lib/extension-release-api';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  return adminReleaseResponse(request, async () => {
    const data = await request.json(), store = releaseStore();
    if (data.action === 'refresh') return store.refresh();
    if (data.action === 'notify') return store.notify(data);
    throw Object.assign(new Error('不明な操作です。'), { status: 400 });
  });
}
