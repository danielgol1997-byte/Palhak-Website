import { SignInCard } from "./ui";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  return (
    <SignInCard
      errorCode={params.error ?? null}
      callbackUrl={params.callbackUrl ?? null}
    />
  );
}


