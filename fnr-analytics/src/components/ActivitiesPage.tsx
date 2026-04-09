import React, { useState } from "react";
import { Search, Loader2, Phone, Mail, CheckSquare, Calendar as CalendarIcon } from "lucide-react";
import { useBitrixActivities } from "../hooks/useBitrix";
import ExportButton from "./ExportButton";
import { ColumnDefinition } from "../utils/exportExcel";

export default function ActivitiesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { activities, loading, error } = useBitrixActivities();

  const filteredActivities = activities.filter(a => 
    (a.SUBJECT && a.SUBJECT.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getActivityIcon = (typeId: string, providerId: string) => {
    if (providerId === 'CALL' || typeId === '2') return <Phone size={14} className="text-blue-400" />;
    if (providerId === 'EMAIL' || typeId === '4') return <Mail size={14} className="text-violet-400" />;
    if (providerId === 'TASK' || typeId === '3') return <CheckSquare size={14} className="text-green-400" />;
    return <CalendarIcon size={14} className="text-amber-400" />; // Meeting / Other
  };

  const exportColumns: ColumnDefinition[] = [
    { header: "ID", key: "ID" },
    { header: "Тема", key: "SUBJECT", width: 40 },
    { header: "Статус", key: "COMPLETED", formatter: (val) => val === 'Y' ? 'Завершено' : 'Открыто' },
    { header: "Время начала", key: "START_TIME", formatter: (val) => new Date(val).toLocaleString() },
    { header: "Время окончания", key: "END_TIME", formatter: (val) => new Date(val).toLocaleString() },
    { header: "Ответственный (ID)", key: "RESPONSIBLE_ID" },
    { header: "Тип", key: "PROVIDER_ID" }
  ];

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
            data={filteredActivities} 
            columns={exportColumns} 
            filename="activities_export" 
            disabled={loading || !!error}
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
                     <td className="py-3 px-2 text-white/50 text-xs">ID: {a.RESPONSIBLE_ID}</td>
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
