import React, { useState } from "react";
import { Settings, Save, Eye, EyeOff, CheckCircle, Database, Wifi, WifiOff, KeyRound } from "lucide-react";
import { bitrix } from "../api/bitrix";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [config, setConfig] = useState({
    webhookUrl: localStorage.getItem('bitrix_webhook_url') || import.meta.env.VITE_BITRIX_WEBHOOK_URL || "",
    appPassword: localStorage.getItem('app_password') || "",
  });

  const handleSave = () => {
    try {
      localStorage.setItem('bitrix_webhook_url', config.webhookUrl.trim());
      if (config.appPassword.trim()) {
        localStorage.setItem('app_password', config.appPassword.trim());
      } else {
        localStorage.removeItem('app_password');
      }
      setSaved(true);
      setTestResult(null);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setTestResult({ ok: false, message: "Ошибка сохранения в localStorage" });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const users = await bitrix.getUsers({});
      setTestResult({ ok: true, message: `Подключено! Найдено пользователей: ${users.length}` });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || "Не удалось подключиться" });
    } finally {
      setTesting(false);
    }
  };

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-white/70 text-sm font-medium mb-1.5">{label}</label>
      {hint && <p className="text-white/25 text-xs mb-2">{hint}</p>}
      {children}
    </div>
  );

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white/80 placeholder-white/20 focus:outline-none focus:border-blue-400/50 focus:bg-white/8 transition-all text-sm";

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Settings size={16} className="text-white/60" />
            </div>
            <h1 className="text-2xl font-bold text-white">Настройки</h1>
          </div>
          <p className="text-white/40 text-sm">Параметры интеграции аналитики</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            saved
              ? "bg-green-500/20 border border-green-500/30 text-green-300"
              : "bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30"
          }`}
        >
          {saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saved ? "Сохранено!" : "Сохранить"}
        </button>
      </div>

      {/* Section: Bitrix24 */}
      <section className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Database size={15} className="text-blue-400" />
          <h2 className="text-white font-semibold text-base">Bitrix24 (Источник данных)</h2>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-3 rounded-xl text-sm mb-4">
          Введите Webhook URL вашего портала Bitrix24. Значение сохраняется локально в браузере.
        </div>

        <Field label="Webhook URL" hint="REST API webhook вашего портала Bitrix24. Права: CRM, Задачи, Пользователи.">
          <div className="relative">
            <input
              type={showWebhook ? "text" : "password"}
              value={config.webhookUrl}
              onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
              placeholder="https://your-portal.bitrix24.ru/rest/1/token/"
              className={inputCls + " pr-11"}
            />
            <button
              onClick={() => setShowWebhook(!showWebhook)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showWebhook ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing || !config.webhookUrl.trim()}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              testing || !config.webhookUrl.trim()
                ? "bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
                : "bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/25"
            }`}
          >
            {testing ? (
              <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            ) : (
              <Wifi size={15} />
            )}
            {testing ? "Проверка..." : "Тест подключения"}
          </button>

          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
              {testResult.ok ? <CheckCircle size={14} /> : <WifiOff size={14} />}
              {testResult.message}
            </div>
          )}
        </div>
      </section>

      {/* Section: App Password */}
      <section className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={15} className="text-violet-400" />
          <h2 className="text-white font-semibold text-base">Пароль приложения</h2>
        </div>

        <Field label="Пароль для входа" hint="По умолчанию: fnr2024. Оставьте пустым для использования пароля по умолчанию.">
          <input
            type="text"
            value={config.appPassword}
            onChange={e => setConfig({ ...config, appPassword: e.target.value })}
            placeholder="fnr2024"
            className={inputCls}
          />
        </Field>
      </section>

      <section className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
         <p className="text-white/40 text-sm">FLEX-N-ROLL Analytics использует прямое подключение к CRM для загрузки Сделок, Контактов и Активностей. Модули прогнозирования временно отключены для обновления.</p>
      </section>
    </div>
  );
}
