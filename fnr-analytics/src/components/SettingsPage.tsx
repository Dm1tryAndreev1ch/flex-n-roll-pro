import React, { useState } from "react";
import { Settings, Save, Eye, EyeOff, CheckCircle, Database } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  // We read the initial value from the env
  const [config, setConfig] = useState({
    webhookUrl: import.meta.env.VITE_BITRIX_WEBHOOK_URL || "",
  });

  const handleSave = async () => {
    // In a real app this would save to a backend or localStorage overrides.
    // For now we just mock the success state.
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
          URL вебхука по умолчанию берется из переменной окружения <code>VITE_BITRIX_WEBHOOK_URL</code>.
        </div>

        <Field label="Webhook URL" hint="REST API webhook вашего портала Bitrix24. Права: CRM, Задачи, Пользователи.">
          <div className="relative">
            <input
              type={showWebhook ? "text" : "password"}
              value={config.webhookUrl}
              onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
              className={inputCls + " pr-11"}
              readOnly
            />
            <button
              onClick={() => setShowWebhook(!showWebhook)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showWebhook ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
      </section>

      <section className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
         <p className="text-white/40 text-sm">FLEX-N-ROLL Analytics использует прямое подключение к CRM для загрузки Сделок, Контактов и Активностей. Модули прогнозирования временно отключены для обновления.</p>
      </section>
    </div>
  );
}
