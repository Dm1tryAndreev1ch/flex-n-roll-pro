import React, { useState, useMemo } from "react";
import { Search, Loader2, Phone, Mail, CheckSquare, Calendar as CalendarIcon } from "lucide-react";
import { useBitrixActivities, useBitrixUsers } from "../hooks/useBitrix";
import ExportButton from "./ExportButton";
import { getUserName } from "../utils/constants";
import type { SheetDefinition } from "../utils/exportExcel";

const ACTIVITY_TYPES: Record<string, string> = {
  '1': 'Встреча',
  '2': 'Звонок',
  '3': 'Задача',
  '4': 'Письмо',
  '5': 'SMS',
  '6': 'Чат',
};

const DIRECTION_LABELS: Record<string, string> = {
  '1': 'Исходящий',
  '2': 'Входящий',
};

function getTypeName(typeId: string, providerId: string): string {
  if (providerId === 'CALL') return 'Звонок';
  if (providerId === 'EMAIL') return 'Письмо';
  if (providerId === 'TASK') return 'Задача';
  return ACTIVITY_TYPES[typeId] || 'Прочее';
}

export default function ActivitiesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { activities, loading, error } = useBitrixActivities();
  const { users } = useBitrixUsers();

  const filteredActivities = activities.filter(a => 
    (a.SUBJECT && a.SUBJECT.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getActivityIcon = (typeId: string, providerId: string) => {
    if (providerId === 'CALL' || typeId === '2') return <Phone size={14} className="text-blue-400" />;
    if (providerId === 'EMAIL' || typeId === '4') return <Mail size={14} className="text-violet-400" />;
    if (providerId === 'TASK' || typeId === '3') return <CheckSquare size={14} className="text-green-400" />;
    return <CalendarIcon size={14} className="text-amber-400" />;
  };

  // ── Multi-sheet export ──
  const exportSheets: SheetDefinition[] = useMemo(() => {
    const completedCount = filteredActivities.filter(a => a.COMPLETED === 'Y').length;
    const openCount = filteredActivities.length - completedCount;

    // Stats by type
    const typeStats: Record<string, { count: number; completed: number; incoming: number; outgoing: number }> = {};
    filteredActivities.forEach(a => {
      const typeName = getTypeName(a.TYPE_ID, a.PROVIDER_ID);
      if (!typeStats[typeName]) typeStats[typeName] = { count: 0, completed: 0, incoming: 0, outgoing: 0 };
      typeStats[typeName].count++;
      if (a.COMPLETED === 'Y') typeStats[typeName].completed++;
      if (a.DIRECTION === '2') typeStats[typeName].incoming++;
      if (a.DIRECTION === '1') typeStats[typeName].outgoing++;
    });

    // Stats by responsible
    const respStats: Record<string, { name: string; count: number; completed: number; calls: number; emails: number }> = {};
    filteredActivities.forEach(a => {
      const uid = a.RESPONSIBLE_ID;
      if (!uid) return;
      if (!respStats[uid]) {
        respStats[uid] = { name: getUserName(uid, users), count: 0, completed: 0, calls: 0, emails: 0 };
      }
      respStats[uid].count++;
      if (a.COMPLETED === 'Y') respStats[uid].completed++;
      if (a.PROVIDER_ID === 'CALL' || a.TYPE_ID === '2') respStats[uid].calls++;
      if (a.PROVIDER_ID === 'EMAIL' || a.TYPE_ID === '4') respStats[uid].emails++;
    });

    return [
      // Sheet 1: All activities
      {
        name: "Все активности",
        columns: [
          { header: "ID", key: "ID", width: 8 },
          { header: "Тема", key: "SUBJECT", width: 45 },
          { header: "Тип", key: "TYPE_LABEL", width: 12, formatter: (_: any, row: any) => getTypeName(row.TYPE_ID, row.PROVIDER_ID) },
          { header: "Направление", key: "DIR_LABEL", width: 14, formatter: (_: any, row: any) => DIRECTION_LABELS[row.DIRECTION] || '' },
          { header: "Статус", key: "COMPLETED", width: 12, formatter: (v: any) => v === 'Y' ? 'Завершено' : 'Открыто' },
          { header: "Время начала", key: "START_TIME", width: 20, formatter: (v: any) => v ? new Date(v).toLocaleString('ru-RU') : '' },
          { header: "Время окончания", key: "END_TIME", width: 20, formatter: (v: any) => v ? new Date(v).toLocaleString('ru-RU') : '' },
          { header: "Длительность (мин)", key: "DURATION", width: 18, formatter: (_: any, row: any) => {
            if (!row.START_TIME || !row.END_TIME) return '';
            const diff = new Date(row.END_TIME).getTime() - new Date(row.START_TIME).getTime();
            return diff > 0 ? Math.round(diff / 60000) : '';
          }},
          { header: "Ответственный", key: "RESP_NAME", width: 22, formatter: (_: any, row: any) => getUserName(row.RESPONSIBLE_ID, users) },
          { header: "Ответственный (ID)", key: "RESPONSIBLE_ID", width: 16 },
          { header: "CRM сущность (ID)", key: "OWNER_ID", width: 16 },
          { header: "Provider", key: "PROVIDER_ID", width: 12 },
        ],
        data: filteredActivities,
        summaryRows: [
          {
            ID: "ИТОГО:",
            SUBJECT: `${filteredActivities.length} активностей`,
            TYPE_LABEL: "",
            DIR_LABEL: "",
            COMPLETED: `Завершено: ${completedCount}`,
            START_TIME: `Открыто: ${openCount}`,
            END_TIME: `Дата отчёта: ${new Date().toLocaleDateString('ru-RU')}`,
          }
        ],
      },
      // Sheet 2: Summary by type
      {
        name: "По типам",
        columns: [
          { header: "Тип активности", key: "type", width: 20 },
          { header: "Всего", key: "count", width: 10 },
          { header: "Завершено", key: "completed", width: 12 },
          { header: "Открыто", key: "open", width: 10, formatter: (_: any, row: any) => row.count - row.completed },
          { header: "% завершения", key: "completionRate", width: 14, formatter: (_: any, row: any) => row.count ? `${Math.round((row.completed / row.count) * 100)}%` : '0%' },
          { header: "Входящие", key: "incoming", width: 12 },
          { header: "Исходящие", key: "outgoing", width: 12 },
        ],
        data: Object.entries(typeStats)
          .map(([type, v]) => ({ type, ...v, open: v.count - v.completed }))
          .sort((a, b) => b.count - a.count),
        summaryRows: [
          {
            type: "ИТОГО:",
            count: filteredActivities.length,
            completed: completedCount,
            open: openCount,
            completionRate: `${filteredActivities.length ? Math.round((completedCount / filteredActivities.length) * 100) : 0}%`,
          },
        ],
      },
      // Sheet 3: By responsible
      {
        name: "По сотрудникам",
        columns: [
          { header: "Сотрудник", key: "name", width: 25 },
          { header: "Всего активностей", key: "count", width: 18 },
          { header: "Завершено", key: "completed", width: 12 },
          { header: "% завершения", key: "rate", width: 14, formatter: (_: any, row: any) => row.count ? `${Math.round((row.completed / row.count) * 100)}%` : '0%' },
          { header: "Звонки", key: "calls", width: 10 },
          { header: "Письма", key: "emails", width: 10 },
          { header: "Прочее", key: "other", width: 10, formatter: (_: any, row: any) => row.count - row.calls - row.emails },
        ],
        data: Object.values(respStats).sort((a, b) => b.count - a.count),
      },
    ];
  }, [filteredActivities, users]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Активности менеджеров</h1>
          <p className="text-white/40 text-sm">Звонки, письма, встречи и задачи</p>
        </div>
        <div className="flex items-center gap-2">
           <ExportButton 
            data={[]} 
            columns={[]} 
            filename="activities_report" 
            disabled={loading || !!error}
            sheets={exportSheets}
            label="Excel отчёт (3 листа)"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
          Ошибка загрузки данных: {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="relative w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
             <input 
              type="text" 
              placeholder="Поиск по теме..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-blue-500/50"
             />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
             <div className="py-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-white/30" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">ID</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Тип / Тема</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Статус</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Время</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Ответственный</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {filteredActivities.map((a) => (
                  <tr key={a.ID} className="hover:bg-white/3 transition-colors">
                     <td className="py-3 px-2 text-white/40 font-mono text-xs">{a.ID}</td>
                     <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                            {getActivityIcon(a.TYPE_ID, a.PROVIDER_ID)}
                          </div>
                          <span className="text-white/90 font-medium">{a.SUBJECT || 'Без темы'}</span>
                        </div>
                     </td>
                     <td className="py-3 px-2">
                        {a.COMPLETED === 'Y' 
                          ? <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-lg">Завершено</span>
                          : <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-lg">Открыто</span>
                        }
                     </td>
                     <td className="py-3 px-2 text-white/50 text-xs">
                       {new Date(a.START_TIME).toLocaleString("ru-RU", { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                       })}
                     </td>
                     <td className="py-3 px-2 text-white/50 text-xs">{getUserName(a.RESPONSIBLE_ID, users)}</td>
                  </tr>
                ))}
                {filteredActivities.length === 0 && (
                   <tr>
                    <td colSpan={5} className="py-10 text-center text-white/30">Активностей не найдено</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
