import { PublicSharePage } from "@/components/public-share-page";

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareSlug: string }>;
}) {
  const { shareSlug } = await params;
  return <PublicSharePage shareSlug={shareSlug} />;
}
