import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Filter, Download, RefreshCw } from "lucide-react";

const DEALS = [
  { id: "D-1042", company: "ООО Мегатрейд",     stage: "Переговоры",   prob: 87, amount: 450000, manager: "Иванов А." },
  { id: "D-1038", company: "ИП Сидоров",         stage: "КП отправлено", prob: 71, amount: 120000, manager: "Петрова Е." },
  { id: "D-1035", company: "ЗАО СтройГрупп",     stage: "Квалификация", prob: 55, amount: 890000, manager: "Козлов М." },
  { id: "D-1031", company: "ООО Альфа-Бизнес",   stage: "Демо",         prob: 93, amount: 220000, manager: "Иванов А." },
  { id: "D-1027", company: "ПАО ТехноЛогик",     stage: "Переговоры",   prob: 68, amount: 1200000, manager: "Смирнова О." },
  { id: "D-1024", company: "ООО ЭкоПарт",        stage: "КП отправлено", prob: 42, amount: 75000,  manager: "Петрова Е." },
  { id: "D-1019", company: "ЗАО ФинансГрупп",    stage: "Демо",         prob: 79, amount: 560000,  manager: "Козлов М." },
  { id: "D-1015", company: "ИП Воронов",          stage: "Квалификация", prob: 31, amount: 45000,   manager: "Смирнова О." },
  { id: "D-1011", company: "ООО МедиаКонтент",   stage: "Переговоры",   prob: 88, amount: 330000,  manager: "Иванов А." },
  { id: "D-1007", company: "ЗАО ТрансЛогист",    stage: "КП отправлено", prob: 61, amount: 780000,  manager: "Петрова Е." },
];

const weekData = [
  { day: "Пн", high: 8,  medium: 14, low: 7 },
  { day: "Вт", high: 11, medium: 12, low: 5 },
  { day: "Ср", high: 6,  medium: 18, low: 9 },
  { day: "Чт", high: 14, medium: 10, low: 3 },
  { day: "Пт", high: 9,  medium: 16, low: 6 },
  { day: "Сб", high: 3,  medium: 6,  low: 4 },
  { day: "Вс", high: 2,  medium: 4,  low: 2 },
];

const getProbColor = (prob: number) => {
  if (prob >= 80) return { bg: "bg-green-500/15", text: "text-green-400", bar: "#22c55e" };
  if (prob >= 60) return { bg: "bg-blue-500/15",  text: "text-blue-400",  bar: "#3b82f6" };
  if (prob >= 40) return { bg: "bg-amber-500/15", text: "text-amber-400", bar: "#f59e0b" };
  return { bg: "bg-red-500/15", text: "text-red-400", bar: "#ef4444" };
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2235] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-white/60 mb-2 text-xs font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/70">{p.name}:</span>
          <span className="text-white font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PredictPage() {
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const filtered = filter === "all" ? DEALS :
    filter === "high" ? DEALS.filter(d => d.prob >= 80) :
    filter === "medium" ? DEALS.filter(d => d.prob >= 60 && d.prob < 80) :
    DEALS.filter(d => d.prob < 60);

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Прогноз сделок</h1>
          </div>
          <p className="text-white/40 text-sm">Ежедневный запуск · 07:00 · RandomForest Classifier</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/10 transition-all text-sm">
            <Download size={15} />
            <span>Экспорт</span>
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-300 hover:bg-blue-500/30 transition-all text-sm"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Всего сделок", value: "143", color: "text-white" },
          { label: "Высокий шанс (≥80%)", value: "52", color: "text-green-400" },
          { label: "Средний (60-79%)", value: "61", color: "text-blue-400" },
        ].map((m) => (
          <div key={m.label} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-white/40 text-xs mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-1">Прогноз по дням (эта неделя)</h3>
        <p className="text-white/30 text-xs mb-5">Сделки по уровню вероятности</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={weekData}>
            <defs>
              <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gMed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="high"   name="Высокий"  stroke="#22c55e" strokeWidth={2} fill="url(#gHigh)" />
            <Area type="monotone" dataKey="medium" name="Средний"  stroke="#3b82f6" strokeWidth={2} fill="url(#gMed)" />
            <Area type="monotone" dataKey="low"    name="Низкий"   stroke="#ef4444" strokeWidth={2} fill="url(#gLow)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Сделки с прогнозом</h3>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-white/30" />
            {["all", "high", "medium", "low"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${filter === f ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-white/40 hover:text-white/60 bg-white/5"}`}
              >
                {{ all: "Все", high: "Высокий", medium: "Средний", low: "Низкий" }[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["ID", "Компания", "Стадия", "Менеджер", "Сумма", "Вероятность"].map((h) => (
                  <th key={h} className="text-left text-white/30 font-medium pb-3 px-2 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {filtered.map((deal) => {
                const c = getProbColor(deal.prob);
                return (
                  <tr key={deal.id} className="hover:bg-white/3 transition-colors group">
                    <td className="py-3 px-2 text-white/40 font-mono text-xs">{deal.id}</td>
                    <td className="py-3 px-2 text-white/90 font-medium">{deal.company}</td>
                    <td className="py-3 px-2">
                      <span className="text-white/50 bg-white/5 px-2 py-0.5 rounded-lg text-xs">{deal.stage}</span>
                    </td>
                    <td className="py-3 px-2 text-white/50 text-xs">{deal.manager}</td>
                    <td className="py-3 px-2 text-white/80 font-medium text-xs">
                      {deal.amount.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full max-w-[60px]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${deal.prob}%`, backgroundColor: c.bar }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${c.text} ${c.bg} px-2 py-0.5 rounded-lg`}>
                          {deal.prob}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
