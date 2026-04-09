import { useState } from "react";
import { Eye, EyeOff, Lock, AlertCircle } from "lucide-react";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));

    const DEMO_PASSWORD = localStorage.getItem('app_password') || 'fnr2024';
    if (password === DEMO_PASSWORD) {
      setLoading(false);
      onLogin();
    } else {
      setError("Неверный пароль");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0f1e]">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-900/20 blur-3xl" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(99,179,237,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,1) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30 mb-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 8L16 4L26 8V16C26 21.5 21.5 26.5 16 28C10.5 26.5 6 21.5 6 16V8Z" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5" />
              <path d="M11 16L14 19L21 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">FLEX-N-ROLL</h1>
          <p className="text-blue-300/70 text-sm mt-1 font-medium tracking-widest uppercase">Analytics Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">Добро пожаловать</h2>
              <p className="text-white/40 text-sm">Введите пароль для входа</p>
            </div>
            <div className="space-y-4 pt-2">
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
                  <Lock size={17} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-11 text-white placeholder-white/25 focus:outline-none focus:border-blue-400/60 focus:bg-white/10 transition-all duration-200 text-sm"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Проверка...</>
              ) : "Войти"}
            </button>
            <p className="text-center text-white/25 text-xs">
              Пароль по умолчанию: <span className="text-white/40">fnr2024</span>
            </p>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          © 2025 FLEX-N-ROLL Analytics. Все права защищены.
        </p>
      </div>
    </div>
  );
}
