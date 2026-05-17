export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <img src="/logo.png" alt="StockAI Pro" className="h-12 w-auto" />
      <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-brandCyan border-t-transparent" />
      <p className="mt-4 text-sm text-textSecondary">Ładowanie...</p>
    </div>
  );
}
