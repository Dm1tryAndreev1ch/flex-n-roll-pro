import { useMemo } from "react";
import { Loader2, Calendar } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBitrixActivities, useBitrixUsers } from "../hooks/useBitrix";
import { getUserName } from "../utils/constants";
import ExportButton from "./ExportButton";
import type { SheetDefinition } from "../utils/exportExcel";

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function ActivityReportPage() {
  const { activities, loading } = useBitrixActivities();
  const { users } = useBitrixUsers();

  const analytics = useMemo(() => {
    if (!activities.length) return { byType: [], byDay: [], hourlyDistribution: [] };

    const typeMap: Record<string, number> = {
      'Звонки': 0, 'Письма': 0, 'Задачи': 0, 'Встречи': 0, 'Прочее': 0
    };
    
    // Day of the week counts
    const dayMap = [0,0,0,0,0,0,0]; // 0=Sun, 1=Mon...
    
    // Heatmap / hourly distribution map
    const hourMap = new Array(24).fill(0);
    
    activities.forEach(a => {
      // Determine Type
      if (a.PROVIDER_ID === 'CALL' || a.TYPE_ID === '2') typeMap['Звонки']++;
      else if (a.PROVIDER_ID === 'EMAIL' || a.TYPE_ID === '4') typeMap['Письма']++;
      else if (a.PROVIDER_ID === 'TASK' || a.TYPE_ID === '3') typeMap['Задачи']++;
      else if (a.TYPE_ID === '1') typeMap['Встречи']++;
      else typeMap['Прочее']++;

      // Time distribution
      if (a.START_TIME) {
        const d = new Date(a.START_TIME);
        dayMap[d.getDay()]++;
        hourMap[d.getHours()]++;
      }
    });

    const byType = Object.keys(typeMap).filter(k=>typeMap[k]>0).map(name => ({ name, count: typeMap[name] })).sort((a,b)=>b.count - a.count);
    const byDay = DAYS.map((name, i) => ({ name, count: dayMap[i] }));
    const hourlyDistribution = hourMap.map((count, hour) => ({ hour: `${hour}:00`, count }));

    return { byType, byDay, hourlyDistribution };
  }, [activities]);

  const { byType, byDay, hourlyDistribution } = analytics;

  // ── Multi-sheet export ──
  const exportSheets: SheetDefinition[] = useMemo(() => {
    
    // Process manager completion speeds and volumes
    const mStats: Record<string, { id: string, name: string, total: number, completed: number, overDues: number }> = {};
    const now = new Date().getTime();
    
    activities.forEach(a => {
        const uid = a.RESPONSIBLE_ID;
        if (!uid) return;
        if (!mStats[uid]) mStats[uid] = { id: uid, name: getUserName(uid, users), total: 0, completed: 0, overDues: 0 };
        mStats[uid].total++;
        if (a.COMPLETED === 'Y') mStats[uid].completed++;
        
        if (a.COMPLETED !== 'Y' && a.DEADLINE && new Date(a.DEADLINE).getTime() < now) {
            mStats[uid].overDues++;
        } else if (a.COMPLETED !== 'Y' && a.END_TIME && new Date(a.END_TIME).getTime() < now) {
            mStats[uid].overDues++;
        }
    });

    return [
      // Sheet 1: Type distribution
      {
        name: "По типам активности",
        columns: [
          { header: "Тип", key: "name", width: 25 },
          { header: "Количество", key: "count", width: 15 },
          { header: "Доля (%)", key: "share", width: 12, formatter: (_v: any, row: any) => activities.length ? Math.round((row.count / activities.length)*100) + '%' : '0%' }
        ],
        data: byType,
        summaryRows: [
            { name: "ВСЕГО:", count: activities.length, share: "100%" }
        ]
      },
      // Sheet 2: Day & Time Load
      {
        name: "Нагрузка по дням и часам",
        columns: [
          { header: "Час дня", key: "hour", width: 15 },
          { header: "Активностей", key: "count", width: 15 },
          { header: "", key: "", width: 5 },
          { header: "День недели", key: "day", width: 15 },
          { header: "Активностей", key: "dayCount", width: 15 },
        ],
        data: hourlyDistribution.map((h, i) => ({
            hour: h.hour,
            count: h.count,
            day: byDay[i] ? byDay[i].name : "",
            dayCount: byDay[i] ? byDay[i].count : ""
        })),
      },
      // Sheet 3: Manager SLA
      {
         name: "Исполнительность",
         columns: [
            { header: "Менеджер", key: "name", width: 25 },
            { header: "Всего задач", key: "total", width: 15 },
            { header: "Успешно закрыто", key: "completed", width: 18 },
            { header: "Просрочено", key: "overDues", width: 15 },
            { header: "Уровень SLA (%)", key: "sla", width: 18, formatter: (_v: any, row: any) => row.total ? Math.round(((row.total - row.overDues) / row.total) * 100) + '%' : '100%'}
         ],
         data: Object.values(mStats).sort((a,b) => b.total - a.total)
      }
    ];
  }, [activities, users, byType, hourlyDistribution, byDay]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Сводка по активностям</h1>
          <p className="text-white/40 text-sm">Анализ каналов коммуникации</p>
        </div>
        <ExportButton data={[]} columns={[]} sheets={exportSheets} filename="activities_report" disabled={loading} label="Analytics (3 листа)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Types Pie Chart */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-6 flex items-center gap-2">Типы коммуникаций</h3>
          {loading ? (
             <div className="h-[300px] flex items-center justify-center"><Loader2 className="animate-spin text-white/30" /></div>
          ) : (
             <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({name, percent}) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {byType.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a2235", border: "none", borderRadius: "10px", color: "white" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Days Bar Chart */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
            <Calendar className="text-blue-400" size={18}/> Нагрузка по дням недели
          </h3>
          {loading ? (
             <div className="h-[300px] flex items-center justify-center"><Loader2 className="animate-spin text-white/30" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a2235", border: "none", borderRadius: "10px", color: "white" }} cursor={{fill: "rgba(255,255,255,0.05)"}}/>
                <Bar dataKey="count" name="Активностей" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
