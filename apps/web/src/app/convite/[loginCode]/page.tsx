import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ loginCode: string }>;
};

export default async function ConviteCodePage({ params }: PageProps) {
  const { loginCode } = await params;
  const safeCode = loginCode.replace(/\D/g, "").slice(0, 6);
  redirect(safeCode ? `/convite?login_code=${safeCode}` : "/convite");
}
