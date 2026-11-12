import { redirect } from "next/navigation";

export default async function MyAppDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/my-apps/${encodeURIComponent(id)}/manage`);
}
