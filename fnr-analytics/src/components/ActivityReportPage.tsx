import React, { useMemo } from "react";
import { Loader2, Calendar } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBitrixActivities } from "../hooks/useBitrix";
import ExportButton from "./ExportButton";

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function ActivityReportPage() {
  const { activities, loading } = useBitrixActivities();

  const analytics = useMemo(() => {
    if (!activities.length) return { byType: [], byDay: [] };

    const typeMap: Record<string, number> = {
      'Звонки': 0, 'Письма': 0, 'Задачи': 0, 'Встречи': 0, 'Прочее': 0
    };
    
    const dayMap = [0,0,0,0,0,0,0]; // 0=Sun, 1=Mon...

    activities.forEach(a => {
      // Determine Type
      if (a.PROVIDER_ID === 'CALL' || a.TYPE_ID === '2') typeMap['Звонки']++;
      else if (a.PROVIDER_ID === 'EMAIL' || a.TYPE_ID === '4') typeMap['Письма']++;
      else if (a.PROVIDER_ID === 'TASK' || a.TYPE_ID === '3') typeMap['Задачи']++;
      else if (a.TYPE_ID === '1') typeMap['Встречи']++;
      else typeMap['Прочее']++;

      // Determine Day
      if (a.START_TIME) {
        const d = new Date(a.START_TIME).getDay();
        dayMap[d]++;
      }
    });

    const byType = Object.keys(typeMap).filter(k=>typeMap[k]>0).map(name => ({ name, count: typeMap[name] }));
    const byDay = DAYS.map((name, i) => ({ name, count: dayMap[i] }));

    return { byType, byDay };
  }, [activities]);

  const { byType, byDay } = analytics;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Сводка по активностям</h1>
          <p className="text-white/40 text-sm">Анализ каналов коммуникации</p>
        </div>
        <ExportButton data={byDay} columns={[{header: "День недели", key: "name"}, {header: "Количество", key:"count"}]} filename="activity_by_day" disabled={loading} />
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
                <Pie data={byType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
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
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
