import { redirect } from "next/navigation";

export default async function BasketIdRedirect({
  params,
}: {
  params: Promise<{ basketId: string }>;
}) {
  const { basketId } = await params;
  redirect(`/crates/${basketId}`);
}
