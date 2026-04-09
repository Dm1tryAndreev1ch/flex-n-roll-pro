import { useState } from "react";
import { Shield, Eye, EyeOff, Lock, User, AlertCircle, CheckCircle } from "lucide-react";

interface LoginPageProps {
  onLogin: () => void;
}

// Мок-пользователи
const USERS: Record<string, { password: string; totpSecret: string }> = {
  admin: { password: "admin123", totpSecret: "JBSWY3DPEHPK3PXP" },
  analyst: { password: "analyst123", totpSecret: "JBSWY3DPEHPK3PXP" },
};

// Симулированный TOTP — просто 6-значный "код"
const VALID_TOTP = "123456";

type Step = "credentials" | "totp";

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    const user = USERS[username.toLowerCase()];
    if (!user || user.password !== password) {
      setError("Неверный логин или пароль");
      setLoading(false);
      return;
    }
    setLoading(false);
    setStep("totp");
  };

  const handleTotpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newTotp = [...totp];
    newTotp[index] = value.slice(-1);
    setTotp(newTotp);
    if (value && index < 5) {
      const next = document.getElementById(`totp-${index + 1}`);
      next?.focus();
    }
    if (newTotp.every((d) => d !== "") && newTotp.join("").length === 6) {
      verifyTotp(newTotp.join(""));
    }
  };

  const handleTotpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !totp[index] && index > 0) {
      const prev = document.getElementById(`totp-${index - 1}`);
      prev?.focus();
    }
  };

  const verifyTotp = async (code: string) => {
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    if (code !== VALID_TOTP) {
      setError("Неверный код аутентификации. Подсказка: 123456");
      setTotp(["", "", "", "", "", ""]);
      document.getElementById("totp-0")?.focus();
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    await new Promise((r) => setTimeout(r, 600));
    onLogin();
  };

  const handleTotpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setTotp(pasted.split(""));
      verifyTotp(pasted);
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
          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className={`flex items-center gap-2 text-sm font-medium transition-all duration-300 ${step === "credentials" ? "text-white" : "text-blue-400"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === "credentials" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40" : "bg-blue-500/30 text-blue-300"}`}>
                {step !== "credentials" ? <CheckCircle size={14} /> : "1"}
              </div>
              <span className="hidden sm:block">Вход</span>
            </div>
            <div className={`h-px w-8 transition-all duration-300 ${step === "totp" ? "bg-blue-400" : "bg-white/20"}`} />
            <div className={`flex items-center gap-2 text-sm font-medium transition-all duration-300 ${step === "totp" ? "text-white" : "text-white/30"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === "totp" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40" : "bg-white/10 text-white/40"}`}>
                2
              </div>
              <span className="hidden sm:block">2FA</span>
            </div>
          </div>

          {/* STEP 1: Credentials */}
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Добро пожаловать</h2>
                <p className="text-white/40 text-sm">Введите учётные данные для входа</p>
              </div>
              <div className="space-y-4 pt-2">
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
                    <User size={17} />
                  </div>
                  <input
                    type="text"
                    placeholder="Логин"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-white/25 focus:outline-none focus:border-blue-400/60 focus:bg-white/10 transition-all duration-200 text-sm"
                    required
                  />
                </div>
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
                ) : "Продолжить →"}
              </button>
              <p className="text-center text-white/25 text-xs">
                Доступ: <span className="text-white/40">admin / analyst</span>
              </p>
            </form>
          )}

          {/* STEP 2: TOTP */}
          {step === "totp" && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Shield size={18} className="text-blue-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">Двухфакторная аутентификация</h2>
                </div>
                <p className="text-white/40 text-sm mt-2">
                  Введите 6-значный код из приложения Google Authenticator
                </p>
              </div>

              {/* QR hint */}
              <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-300">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h.01M14 17h.01M17 14h.01M20 14h.01M17 17h3v3h-3zM20 20v.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-blue-200 text-xs font-medium">Демо-режим</p>
                  <p className="text-blue-300/60 text-xs mt-0.5">Код для входа: <span className="text-cyan-400 font-mono font-bold">123456</span></p>
                </div>
              </div>

              {/* OTP Input */}
              <div className="flex gap-2 justify-center" onPaste={handleTotpPaste}>
                {totp.map((digit, index) => (
                  <input
                    key={index}
                    id={`totp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleTotpChange(index, e.target.value)}
                    onKeyDown={(e) => handleTotpKeyDown(index, e)}
                    className={`w-11 h-13 text-center text-xl font-bold bg-white/5 border rounded-xl text-white focus:outline-none transition-all duration-200
                      ${success ? "border-green-400/60 bg-green-500/10" : digit ? "border-blue-400/60 bg-white/10" : "border-white/10"}
                      focus:border-blue-400/60 focus:bg-white/10`}
                    style={{ height: "52px" }}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm">
                  <CheckCircle size={15} className="shrink-0" />
                  Аутентификация успешна! Загрузка...
                </div>
              )}

              {loading && !success && (
                <div className="flex items-center justify-center gap-2 text-blue-300 text-sm">
                  <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                  Проверка кода...
                </div>
              )}

              <button
                type="button"
                onClick={() => { setStep("credentials"); setError(""); setTotp(["","","","","",""]); }}
                className="w-full py-2.5 text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                ← Назад
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          © 2025 FLEX-N-ROLL Analytics. Все права защищены.
        </p>
      </div>
    </div>
  );
}
