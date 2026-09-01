import { LoginForm } from "@/components/admin/LoginForm";

export default async function AdminLoginPage(props: PageProps<"/admin/login">) {
  const searchParams = await props.searchParams;
  const initialError =
    searchParams.error === "not_operator"
      ? "このアカウントはオペレーターとして登録されていません。"
      : undefined;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6">
      <h1 className="text-lg font-semibold">管理画面ログイン</h1>
      <LoginForm initialError={initialError} />
    </div>
  );
}
