import { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { UserX, AlertTriangle, Shield, Phone, Mail, TrendingDown } from "lucide-react";

const CLIENTS = [
  { id: "C-0201", company: "ООО Ритейл Плюс",   risk: "HIGH",   score: 89, lastContact: "45 дн.", revenue: 340000, reason: "Нет активности 45 дней, снижение суммы" },
  { id: "C-0198", company: "ЗАО СнабПром",       risk: "HIGH",   score: 82, lastContact: "38 дн.", revenue: 120000, reason: "Просрочка платежа, жалобы в поддержку" },
  { id: "C-0187", company: "ИП Кириллов",        risk: "MEDIUM", score: 61, lastContact: "20 дн.", revenue: 55000,  reason: "Снижение частоты заказов" },
  { id: "C-0184", company: "ПАО ЛогТрейд",       risk: "MEDIUM", score: 58, lastContact: "15 дн.", revenue: 780000, reason: "Конкурент предложил скидку" },
  { id: "C-0179", company: "ООО ПромСталь",      risk: "HIGH",   score: 91, lastContact: "60 дн.", revenue: 230000, reason: "Нет ответов, менеджер сменился" },
  { id: "C-0171", company: "ЗАО АгроТех",        risk: "MEDIUM", score: 44, lastContact: "10 дн.", revenue: 890000, reason: "Запрос о расторжении договора" },
  { id: "C-0165", company: "ООО ТехИмпорт",      risk: "LOW",    score: 22, lastContact: "3 дн.",  revenue: 460000, reason: "Стабильный клиент, активность нормальная" },
  { id: "C-0158", company: "ИП Маслова",         risk: "LOW",    score: 18, lastContact: "2 дн.",  revenue: 38000,  reason: "Постоянные заказы, доволен сервисом" },
  { id: "C-0151", company: "ООО ДигиСофт",       risk: "MEDIUM", score: 53, lastContact: "12 дн.", revenue: 195000, reason: "Уменьшение среднего чека" },
  { id: "C-0144", company: "ЗАО МетроСтрой",     risk: "HIGH",   score: 77, lastContact: "30 дн.", revenue: 670000, reason: "Финансовые трудности у клиента" },
];

const radarData = [
  { subject: "Активность", А: 30, fullMark: 100 },
  { subject: "Платежи",    А: 65, fullMark: 100 },
  { subject: "Контакты",   А: 40, fullMark: 100 },
  { subject: "Средний чек", А: 55, fullMark: 100 },
  { subject: "NPS",        А: 45, fullMark: 100 },
  { subject: "Лояльность", А: 35, fullMark: 100 },
];

const RISK_CONFIG: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  HIGH:   { bg: "bg-red-500/15",    text: "text-red-400",    border: "border-red-500/20",    icon: <AlertTriangle size={13} />, label: "ВЫСОКИЙ" },
  MEDIUM: { bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/20",  icon: <TrendingDown  size={13} />, label: "СРЕДНИЙ" },
  LOW:    { bg: "bg-green-500/15",  text: "text-green-400",  border: "border-green-500/20",  icon: <Shield        size={13} />, label: "НИЗКИЙ" },
};

export default function ChurnPage() {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<typeof CLIENTS[0] | null>(null);

  const filtered = filter === "all" ? CLIENTS : CLIENTS.filter(c => c.risk === filter);

  const highCount   = CLIENTS.filter(c => c.risk === "HIGH").length;
  const mediumCount = CLIENTS.filter(c => c.risk === "MEDIUM").length;
  const lowCount    = CLIENTS.filter(c => c.risk === "LOW").length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <UserX size={16} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Churn Detection</h1>
          </div>
          <p className="text-white/40 text-sm">Ежедневный запуск · 08:00 · GradientBoosting Classifier</p>
        </div>
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-red-300 text-sm font-medium">HIGH-риск: {highCount} клиентов</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Высокий риск",  value: highCount,   color: "text-red-400",    bg: "from-red-500/10 to-red-600/5",   border: "border-red-500/20" },
          { label: "Средний риск",  value: mediumCount, color: "text-amber-400",  bg: "from-amber-500/10 to-amber-600/5", border: "border-amber-500/20" },
          { label: "Низкий риск",   value: lowCount,    color: "text-green-400",  bg: "from-green-500/10 to-green-600/5", border: "border-green-500/20" },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/40 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table */}
        <div className="lg:col-span-2 bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold">Клиенты по риску</h3>
            <div className="flex items-center gap-2">
              {["all", "HIGH", "MEDIUM", "LOW"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all ${filter === f ? "bg-red-500/20 text-red-300 border border-red-500/30" : "text-white/40 hover:text-white/60 bg-white/5"}`}
                >
                  {{ all: "Все", HIGH: "HIGH", MEDIUM: "MED", LOW: "LOW" }[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {filtered.map((client) => {
              const cfg = RISK_CONFIG[client.risk];
              const isSelected = selected?.id === client.id;
              return (
                <button
                  key={client.id}
                  onClick={() => setSelected(isSelected ? null : client)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${isSelected ? "bg-white/8 border border-white/15" : "bg-white/3 hover:bg-white/5 border border-transparent"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border} border shrink-0`}>
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-white/90 text-sm font-medium truncate">{client.company}</p>
                        <span className="text-white/30 text-xs font-mono ml-2">{client.id}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-white/35 text-xs">Посл. контакт: {client.lastContact}</span>
                        <span className="text-white/35 text-xs">{client.revenue.toLocaleString("ru-RU")} ₽</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-white">{client.score}%</div>
                      <div className="text-white/25 text-[10px]">риск</div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-white/8 space-y-3">
                      <p className="text-white/50 text-xs"><span className="text-white/30">Причина:</span> {client.reason}</p>
                      <div className="flex gap-2">
                        <button className="flex items-center gap-1.5 text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/25 transition-colors">
                          <Phone size={12} /> Позвонить
                        </button>
                        <button className="flex items-center gap-1.5 text-xs bg-violet-500/15 text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-lg hover:bg-violet-500/25 transition-colors">
                          <Mail size={12} /> Email
                        </button>
                        <button className="flex items-center gap-1.5 text-xs bg-white/5 text-white/40 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                          Создать задачу в Bitrix
                        </button>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Radar */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">Профиль риска</h3>
          <p className="text-white/30 text-xs mb-4">Средние показатели HIGH-риска</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} />
              <Radar name="Показатель" dataKey="А" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", fontSize: "12px" }}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs text-white/40 bg-white/3 rounded-lg px-3 py-2">
              <span>Среднее дней без контакта</span>
              <span className="text-red-400 font-bold">34.7</span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/40 bg-white/3 rounded-lg px-3 py-2">
              <span>Отток под угрозой (выручка)</span>
              <span className="text-red-400 font-bold">2.1M ₽</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
