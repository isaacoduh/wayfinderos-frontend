import { SharePreview } from '@/components/share-preview'
export default async function SharePage({params}:{params:Promise<{tripId:string}>}){await params;return <SharePreview/>}
