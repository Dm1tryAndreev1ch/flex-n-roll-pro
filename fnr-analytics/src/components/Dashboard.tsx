import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, UserX, ShoppingBag,
  CheckCircle, AlertTriangle, XCircle, Activity, Zap,
} from "lucide-react";

const dealTrend = [
  { day: "Пн", закрыто: 12, прогноз: 15, потеряно: 3 },
  { day: "Вт", закрыто: 19, прогноз: 18, потеряно: 2 },
  { day: "Ср", закрыто: 8,  прогноз: 14, потеряно: 5 },
  { day: "Чт", закрыто: 22, прогноз: 20, потеряно: 1 },
  { day: "Пт", закрыто: 17, прогноз: 19, потеряно: 4 },
  { day: "Сб", закрыто: 5,  прогноз: 7,  потеряно: 2 },
  { day: "Вс", закрыто: 3,  прогноз: 4,  потеряно: 1 },
];

const churnData = [
  { name: "LOW", value: 58, color: "#22c55e" },
  { name: "MEDIUM", value: 29, color: "#f59e0b" },
  { name: "HIGH", value: 13, color: "#ef4444" },
];

const monthlyAccuracy = [
  { month: "Янв", accuracy: 82 },
  { month: "Фев", accuracy: 85 },
  { month: "Мар", accuracy: 79 },
  { month: "Апр", accuracy: 88 },
  { month: "Май", accuracy: 91 },
  { month: "Июн", accuracy: 87 },
];

const RECENT_JOBS = [
  { name: "Прогноз сделок",     time: "07:00", status: "success", count: "143 сделки" },
  { name: "Churn Detection",    time: "08:00", status: "success", count: "HIGH: 24" },
  { name: "Время контакта",     time: "09:00", status: "success", count: "89 компаний" },
  { name: "Cross-Sell",         time: "Пн 10:00", status: "warning", count: "67 рекомендаций" },
  { name: "Переобучение моделей", time: "01.06 03:00", status: "success", count: "4 модели" },
];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "success") return <CheckCircle size={15} className="text-green-400" />;
  if (status === "warning") return <AlertTriangle size={15} className="text-amber-400" />;
  return <XCircle size={15} className="text-red-400" />;
};

const STAT_CARDS = [
  {
    label: "Сделки (прогноз)",
    value: "143",
    sub: "+12% за неделю",
    trend: "up",
    icon: <TrendingUp size={20} />,
    color: "blue",
    gradient: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/20",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    label: "Churn HIGH-риск",
    value: "24",
    sub: "из 184 клиентов",
    trend: "down",
    icon: <UserX size={20} />,
    color: "red",
    gradient: "from-red-500/20 to-red-600/5",
    border: "border-red-500/20",
    iconBg: "bg-red-500/20",
    iconColor: "text-red-400",
  },
  {
    label: "Cross-Sell",
    value: "67",
    sub: "новых рекомендаций",
    trend: "up",
    icon: <ShoppingBag size={20} />,
    color: "violet",
    gradient: "from-violet-500/20 to-violet-600/5",
    border: "border-violet-500/20",
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-400",
  },
  {
    label: "Точность моделей",
    value: "91%",
    sub: "после переобучения",
    trend: "up",
    icon: <Activity size={20} />,
    color: "cyan",
    gradient: "from-cyan-500/20 to-cyan-600/5",
    border: "border-cyan-500/20",
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
  },
];

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

export default function Dashboard() {
  const now = new Date();
  const nextRun = "07:00";

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Дашборд</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-300 text-sm font-medium">Планировщик активен</span>
          <span className="text-green-400/50 text-xs ml-1">· след. {nextRun}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            className={`bg-gradient-to-br ${card.gradient} border ${card.border} rounded-2xl p-5 relative overflow-hidden`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center ${card.iconColor}`}>
                {card.icon}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${card.trend === "up" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                {card.trend === "up" ? "↑" : "↓"}
              </span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{card.value}</p>
            <p className="text-white/50 text-sm">{card.label}</p>
            <p className="text-white/30 text-xs mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deal trend */}
        <div className="lg:col-span-2 bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-semibold">Динамика сделок</h3>
              <p className="text-white/30 text-xs mt-0.5">Закрытые vs прогноз (7 дней)</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 rounded inline-block" /> закрыто</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 rounded inline-block border-dashed border" /> прогноз</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dealTrend}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="закрыто" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBlue)" />
              <Area type="monotone" dataKey="прогноз" stroke="#22d3ee" strokeWidth={2} strokeDasharray="5 3" fill="url(#gradCyan)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Churn pie */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="mb-5">
            <h3 className="text-white font-semibold">Churn-риск</h3>
            <p className="text-white/30 text-xs mt-0.5">Распределение по уровням</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={churnData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {churnData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }}
                formatter={(v: any) => [`${v}%`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {churnData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-white/50">{d.name}</span>
                </div>
                <span className="text-white font-semibold">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Accuracy */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-semibold">Точность моделей</h3>
              <p className="text-white/30 text-xs mt-0.5">Ежемесячная метрика</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2 py-1">
              <Zap size={11} />
              <span>Обновлено 1 июня</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyAccuracy} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="accuracy" name="Точность %" radius={[6, 6, 0, 0]}>
                {monthlyAccuracy.map((_entry, index) => (
                  <Cell key={index} fill={index === monthlyAccuracy.length - 1 ? "#22d3ee" : "#3b82f6"} fillOpacity={index === monthlyAccuracy.length - 1 ? 1 : 0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent jobs */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-semibold">Последние задачи</h3>
              <p className="text-white/30 text-xs mt-0.5">Лог выполнения планировщика</p>
            </div>
            <span className="text-xs text-white/30">Сегодня</span>
          </div>
          <div className="space-y-2">
            {RECENT_JOBS.map((job, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors">
                <StatusIcon status={job.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-medium truncate">{job.name}</p>
                  <p className="text-white/30 text-xs">{job.count}</p>
                </div>
                <span className="text-white/25 text-xs font-mono shrink-0">{job.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
