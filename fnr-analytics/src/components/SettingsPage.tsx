import { useState } from "react";
import { Settings, Save, Eye, EyeOff, CheckCircle, Database, Bell, Shield, Clock } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  const [config, setConfig] = useState({
    webhookUrl: "https://b24-xxxxx.bitrix24.ru/rest/1/xxxxxxxxx/",
    logLevel: "INFO",
    predictTime: "07:00",
    churnTime: "08:00",
    contactTime: "09:00",
    crossSellDay: "monday",
    retrainDay: "1",
    notifyEmail: "admin@flexnroll.ru",
    notifyTelegram: "@fnr_analytics_bot",
    maxLogSizeMb: "10",
    logBackups: "5",
    cacheInvalidate: true,
    autoRetrain: true,
    sendReports: true,
    notifyOnError: true,
  });

  const handleSave = async () => {
    await new Promise(r => setTimeout(r, 800));
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

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-all duration-200 ${value ? "bg-blue-500" : "bg-white/15"}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${value ? "left-6" : "left-1"}`} />
    </button>
  );

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white/80 placeholder-white/20 focus:outline-none focus:border-blue-400/50 focus:bg-white/8 transition-all text-sm";
  const selectCls = inputCls + " cursor-pointer";

  return (
    <div className="p-6 space-y-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Settings size={16} className="text-white/60" />
            </div>
            <h1 className="text-2xl font-bold text-white">Настройки</h1>
          </div>
          <p className="text-white/40 text-sm">Конфигурация планировщика и интеграций</p>
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
          <h2 className="text-white font-semibold text-base">Bitrix24</h2>
        </div>
        <Field label="Webhook URL" hint="REST API webhook вашего портала Bitrix24">
          <div className="relative">
            <input
              type={showWebhook ? "text" : "password"}
              value={config.webhookUrl}
              onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Уровень логирования">
            <select
              value={config.logLevel}
              onChange={e => setConfig({ ...config, logLevel: e.target.value })}
              className={selectCls}
            >
              {["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Размер файла лога (МБ)">
            <input
              type="number"
              value={config.maxLogSizeMb}
              onChange={e => setConfig({ ...config, maxLogSizeMb: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/3">
          <div>
            <p className="text-white/70 text-sm">Инвалидация кэша при переобучении</p>
            <p className="text-white/25 text-xs">Сброс кэша Bitrix перед полным переобучением</p>
          </div>
          <Toggle value={config.cacheInvalidate} onChange={v => setConfig({ ...config, cacheInvalidate: v })} />
        </div>
      </section>

      {/* Section: Scheduler */}
      <section className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={15} className="text-cyan-400" />
          <h2 className="text-white font-semibold text-base">Расписание задач</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Прогноз сделок">
            <input type="time" value={config.predictTime} onChange={e => setConfig({ ...config, predictTime: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Churn Detection">
            <input type="time" value={config.churnTime} onChange={e => setConfig({ ...config, churnTime: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Время контакта">
            <input type="time" value={config.contactTime} onChange={e => setConfig({ ...config, contactTime: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cross-sell (день недели)">
            <select value={config.crossSellDay} onChange={e => setConfig({ ...config, crossSellDay: e.target.value })} className={selectCls}>
              {[["monday","Понедельник"],["tuesday","Вторник"],["wednesday","Среда"],["thursday","Четверг"],["friday","Пятница"]].map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Переобучение (день месяца)">
            <select value={config.retrainDay} onChange={e => setConfig({ ...config, retrainDay: e.target.value })} className={selectCls}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={String(d)}>{d}-е число</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/3">
          <div>
            <p className="text-white/70 text-sm">Автоматическое переобучение</p>
            <p className="text-white/25 text-xs">Запускать полное переобучение по расписанию</p>
          </div>
          <Toggle value={config.autoRetrain} onChange={v => setConfig({ ...config, autoRetrain: v })} />
        </div>
      </section>

      {/* Section: Notifications */}
      <section className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell size={15} className="text-amber-400" />
          <h2 className="text-white font-semibold text-base">Уведомления</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email для отчётов">
            <input type="email" value={config.notifyEmail} onChange={e => setConfig({ ...config, notifyEmail: e.target.value })} className={inputCls} placeholder="admin@company.ru" />
          </Field>
          <Field label="Telegram-бот">
            <input type="text" value={config.notifyTelegram} onChange={e => setConfig({ ...config, notifyTelegram: e.target.value })} className={inputCls} placeholder="@your_bot" />
          </Field>
        </div>
        <div className="space-y-2">
          {[
            { key: "sendReports", label: "Отправлять ежедневные отчёты", sub: "Email + Telegram после каждой задачи" },
            { key: "notifyOnError", label: "Уведомление об ошибках", sub: "Немедленно при сбое задачи" },
          ].map(({ key, label, sub }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/3">
              <div>
                <p className="text-white/70 text-sm">{label}</p>
                <p className="text-white/25 text-xs">{sub}</p>
              </div>
              <Toggle
                value={config[key as keyof typeof config] as boolean}
                onChange={v => setConfig({ ...config, [key]: v })}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Section: Security */}
      <section className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={15} className="text-green-400" />
          <h2 className="text-white font-semibold text-base">Безопасность</h2>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/15">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-500/15 flex items-center justify-center">
              <Shield size={15} className="text-green-400" />
            </div>
            <div>
              <p className="text-white/70 text-sm">Двухфакторная аутентификация</p>
              <p className="text-white/25 text-xs">TOTP (Google Authenticator) — активна</p>
            </div>
          </div>
          <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-lg font-medium">
            ✓ Включена
          </span>
        </div>
        <div className="p-3 rounded-xl bg-white/3 text-xs text-white/30 space-y-1">
          <p>• Сессия истекает через 8 часов бездействия</p>
          <p>• Все действия логируются с временной меткой</p>
          <p>• Webhook URL хранится в зашифрованном виде</p>
        </div>
      </section>
    </div>
  );
}
