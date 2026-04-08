import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ShoppingBag, ArrowRight, Star, TrendingUp, CheckSquare } from "lucide-react";

const RECOMMENDATIONS = [
  { company: "ООО Мегатрейд",   from: "Тариф Старт", to: "Тариф Про",      confidence: 0.91, revenue: 45000, status: "new" },
  { company: "ЗАО СтройГрупп",  from: "Базовый пакет", to: "Аналитика Pro",  confidence: 0.85, revenue: 28000, status: "new" },
  { company: "ИП Кириллов",     from: "Тариф Про",    to: "Интеграция API", confidence: 0.78, revenue: 62000, status: "sent" },
  { company: "ПАО ТехноЛогик",  from: "Стандарт",     to: "Корп. лицензия", confidence: 0.93, revenue: 180000, status: "new" },
  { company: "ООО АльфаБизнес", from: "Базовый",       to: "Тариф Бизнес",  confidence: 0.72, revenue: 35000, status: "done" },
  { company: "ЗАО ФинансГрупп", from: "Тариф Старт",  to: "Тариф Про",     confidence: 0.88, revenue: 45000, status: "sent" },
  { company: "ООО ЭкоПарт",     from: "Стандарт",     to: "Аналитика Pro",  confidence: 0.69, revenue: 22000, status: "new" },
  { company: "ПАО ЛогТрейд",    from: "Базовый пакет", to: "Корп. лицензия", confidence: 0.96, revenue: 240000, status: "new" },
];

const topProducts = [
  { name: "Тариф Про",       count: 24, color: "#3b82f6" },
  { name: "Аналитика Pro",   count: 18, color: "#8b5cf6" },
  { name: "Корп. лицензия",  count: 12, color: "#22d3ee" },
  { name: "Интеграция API",  count: 8,  color: "#f59e0b" },
  { name: "Тариф Бизнес",    count: 5,  color: "#22c55e" },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  new:  { bg: "bg-blue-500/15",   text: "text-blue-400",   label: "Новая" },
  sent: { bg: "bg-amber-500/15",  text: "text-amber-400",  label: "Отправлена" },
  done: { bg: "bg-green-500/15",  text: "text-green-400",  label: "Выполнена" },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2235] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-white/60 mb-1 text-xs">{label}</p>
      <p className="text-white font-bold">{payload[0].value} рекомендаций</p>
    </div>
  );
};

export default function CrossSellPage() {
  const totalRevenue = RECOMMENDATIONS.reduce((s, r) => s + r.revenue, 0);
  const newCount  = RECOMMENDATIONS.filter(r => r.status === "new").length;
  const doneCount = RECOMMENDATIONS.filter(r => r.status === "done").length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <ShoppingBag size={16} className="text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Cross-Sell рекомендации</h1>
          </div>
          <p className="text-white/40 text-sm">Еженедельный запуск · Пн 10:00 · Apriori + ML-ранжирование</p>
        </div>
        <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-2">
          <Star size={14} className="text-violet-400" />
          <span className="text-violet-300 text-sm font-medium">{RECOMMENDATIONS.length} рекомендаций</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Новых задач",        value: newCount,                         color: "text-blue-400" },
          { label: "Выполнено",          value: doneCount,                        color: "text-green-400" },
          { label: "Потенциал (₽)",      value: `${(totalRevenue / 1000).toFixed(0)}K`,  color: "text-violet-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/40 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recommendations list */}
        <div className="lg:col-span-2 bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold">Рекомендации по апселлу</h3>
            <div className="text-xs text-white/30">Сортировка: по уверенности ↓</div>
          </div>
          <div className="space-y-2">
            {RECOMMENDATIONS.sort((a, b) => b.confidence - a.confidence).map((rec, i) => {
              const sc = STATUS_CONFIG[rec.status];
              return (
                <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-white/3 hover:bg-white/5 transition-colors group">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                    <TrendingUp size={14} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm font-medium truncate">{rec.company}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/35">
                      <span className="text-white/50">{rec.from}</span>
                      <ArrowRight size={10} className="text-violet-400" />
                      <span className="text-violet-300 font-medium">{rec.to}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="text-white/30 text-xs">уверен.</div>
                      <div className={`text-xs font-bold ${rec.confidence >= 0.9 ? "text-green-400" : rec.confidence >= 0.8 ? "text-blue-400" : "text-amber-400"}`}>
                        {(rec.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-white/50 text-xs font-medium">+{rec.revenue.toLocaleString("ru-RU")} ₽</div>
                  </div>
                  <div>
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <CheckSquare size={16} className="text-white/30 hover:text-green-400 transition-colors" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">Топ продуктов</h3>
          <p className="text-white/30 text-xs mb-5">Наиболее рекомендуемые</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProducts} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {topProducts.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Star size={13} className="text-violet-400" />
              <span className="text-violet-300 text-xs font-medium">Лучшая связка</span>
            </div>
            <p className="text-white/70 text-sm font-medium">Старт → Про</p>
            <p className="text-white/30 text-xs mt-0.5">Конверсия 34% · 24 сделки</p>
          </div>
        </div>
      </div>
    </div>
  );
}
