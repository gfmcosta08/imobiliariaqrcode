import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ public_id: string }>;
};

export default async function LegacyImovelPage({ params }: PageProps) {
  const { public_id } = await params;
  redirect(`/imoveis/${encodeURIComponent(public_id)}`);
}
