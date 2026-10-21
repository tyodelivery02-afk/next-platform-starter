import { releaseResponse, releaseStore } from '../../../../../lib/extension-release-api';
export const dynamic = 'force-dynamic';
export async function GET() { return releaseResponse(() => releaseStore().latest()); }
