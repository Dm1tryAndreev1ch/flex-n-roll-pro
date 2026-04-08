import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Clock, Phone, MessageSquare, Calendar } from "lucide-react";

const COMPANIES = [
  { company: "ООО Мегатрейд",   bestDay: "Вт",  bestTime: "10:00–12:00", channel: "Phone", score: 94, manager: "Иванов А.",   calls: 28 },
  { company: "ЗАО СтройГрупп",  bestDay: "Чт",  bestTime: "14:00–16:00", channel: "Email", score: 87, manager: "Козлов М.",   calls: 15 },
  { company: "ИП Сидоров",       bestDay: "Пн",  bestTime: "09:00–11:00", channel: "Phone", score: 91, manager: "Петрова Е.", calls: 34 },
  { company: "ПАО ТехноЛогик",  bestDay: "Ср",  bestTime: "11:00–13:00", channel: "Email", score: 78, manager: "Смирнова О.", calls: 22 },
  { company: "ООО АльфаБизнес", bestDay: "Пт",  bestTime: "15:00–17:00", channel: "Phone", score: 83, manager: "Иванов А.",   calls: 19 },
  { company: "ЗАО ФинансГрупп", bestDay: "Вт",  bestTime: "10:00–12:00", channel: "Chat",  score: 71, manager: "Козлов М.",   calls: 11 },
  { company: "ООО ЭкоПарт",     bestDay: "Чт",  bestTime: "13:00–15:00", channel: "Phone", score: 88, manager: "Петрова Е.", calls: 26 },
  { company: "ИП Воронов",       bestDay: "Ср",  bestTime: "09:00–11:00", channel: "Email", score: 65, manager: "Смирнова О.", calls: 8  },
];

const heatmapData: { hour: string; [key: string]: number | string }[] = [
  { hour: "08–09", Пн: 12, Вт: 34, Ср: 28, Чт: 45, Пт: 38 },
  { hour: "09–10", Пн: 45, Вт: 67, Ср: 58, Чт: 72, Пт: 61 },
  { hour: "10–11", Пн: 78, Вт: 89, Ср: 82, Чт: 91, Пт: 85 },
  { hour: "11–12", Пн: 82, Вт: 94, Ср: 88, Чт: 87, Пт: 79 },
  { hour: "12–13", Пн: 41, Вт: 35, Ср: 38, Чт: 42, Пт: 36 },
  { hour: "13–14", Пн: 55, Вт: 61, Ср: 59, Чт: 68, Пт: 52 },
  { hour: "14–15", Пн: 71, Вт: 75, Ср: 70, Чт: 82, Пт: 76 },
  { hour: "15–16", Пн: 68, Вт: 72, Ср: 65, Чт: 77, Пт: 83 },
  { hour: "16–17", Пн: 48, Вт: 52, Ср: 49, Чт: 55, Пт: 64 },
  { hour: "17–18", Пн: 22, Вт: 25, Ср: 20, Чт: 28, Пт: 31 },
];

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт"];

const getHeatColor = (value: number) => {
  if (value >= 85) return "bg-green-400/80 text-white";
  if (value >= 70) return "bg-green-400/50 text-green-200";
  if (value >= 55) return "bg-blue-400/50 text-blue-200";
  if (value >= 40) return "bg-blue-400/25 text-blue-300/70";
  return "bg-white/5 text-white/20";
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  Phone: <Phone size={13} />,
  Email: <MessageSquare size={13} />,
  Chat:  <MessageSquare size={13} />,
};

const channelBar = [
  { name: "Phone", value: 52, color: "#3b82f6" },
  { name: "Email", value: 31, color: "#8b5cf6" },
  { name: "Chat",  value: 17, color: "#22d3ee" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2235] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-white/60 mb-1 text-xs">{label}</p>
      <p className="text-white font-bold">{payload[0].value}% эффективность</p>
    </div>
  );
};

export default function OptimizerPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Clock size={16} className="text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Оптимальное время контакта</h1>
          </div>
          <p className="text-white/40 text-sm">Ежедневный запуск · 09:00 · Анализ поведенческих паттернов</p>
        </div>
      </div>

      {/* Top strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Обработано компаний", value: "89",    icon: <Calendar size={16} className="text-cyan-400" /> },
          { label: "Пиковое время",        value: "10–12", icon: <Clock size={16} className="text-blue-400" /> },
          { label: "Лучший канал",         value: "Phone", icon: <Phone size={16} className="text-violet-400" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-white/35 text-xs">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Heatmap */}
        <div className="lg:col-span-2 bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">Тепловая карта звонков</h3>
          <p className="text-white/30 text-xs mb-5">Эффективность по часам и дням недели</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-white/30 font-medium pb-2 text-left pr-3 w-16">Время</th>
                  {DAYS.map(d => (
                    <th key={d} className="text-white/30 font-medium pb-2 text-center px-1">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="space-y-1">
                {heatmapData.map((row) => (
                  <tr key={row.hour}>
                    <td className="text-white/30 pr-3 py-1 font-mono">{row.hour}</td>
                    {DAYS.map((day) => {
                      const val = row[day] as number;
                      return (
                        <td key={day} className="px-1 py-0.5">
                          <div className={`${getHeatColor(val)} rounded-md text-center py-1.5 px-1 font-medium transition-all text-[11px]`}>
                            {val}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-white/25 text-xs">Менее эффективно</span>
            <div className="flex gap-1">
              {["bg-white/5", "bg-blue-400/25", "bg-blue-400/50", "bg-green-400/50", "bg-green-400/80"].map((c, i) => (
                <div key={i} className={`w-6 h-3 rounded ${c}`} />
              ))}
            </div>
            <span className="text-white/25 text-xs">Более эффективно</span>
          </div>
        </div>

        {/* Channel chart */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">Каналы коммуникации</h3>
          <p className="text-white/30 text-xs mb-5">Распределение успешных контактов</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={channelBar} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="%" radius={[6, 6, 0, 0]}>
                {channelBar.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {channelBar.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                  <span className="text-white/50">{c.name}</span>
                </div>
                <span className="text-white font-semibold">{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Companies table */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-5">Рекомендации по компаниям</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {COMPANIES.map((c) => (
            <div key={c.company} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/6 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                {CHANNEL_ICON[c.channel]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm font-medium truncate">{c.company}</p>
                <p className="text-white/30 text-xs">{c.manager} · {c.channel}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-cyan-400 font-bold text-sm">{c.bestDay} {c.bestTime}</div>
                <div className="text-white/30 text-xs">score: {c.score}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
