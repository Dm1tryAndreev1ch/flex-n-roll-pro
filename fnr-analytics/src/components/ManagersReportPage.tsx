import React, { useMemo } from "react";
import { Loader2, Trophy, PhoneCall } from "lucide-react";
import { useBitrixDeals, useBitrixUsers, useBitrixActivities } from "../hooks/useBitrix";
import { getStageInfo, getUserName } from "../utils/constants";
import ExportButton from "./ExportButton";

export default function ManagersReportPage() {
  const { deals, loading: dLoad } = useBitrixDeals();
  const { users, loading: uLoad } = useBitrixUsers();
  const { activities, loading: aLoad } = useBitrixActivities();

  const loading = dLoad || uLoad || aLoad;

  const managerStats = useMemo(() => {
    if (loading) return [];
    
    const map: Record<string, any> = {};

    // Process deals
    deals.forEach(d => {
      const uId = d.ASSIGNED_BY_ID;
      if (!uId) return;

      if (!map[uId]) {
        map[uId] = { id: uId, name: getUserName(uId, users), wonSum: 0, wonCount: 0, activeCount: 0, actsCount: 0 };
      }

      const stage = getStageInfo(d.STAGE_ID);
      if (stage.color === 'green') {
        map[uId].wonSum += parseFloat(d.OPPORTUNITY || 0);
        map[uId].wonCount += 1;
      } else if (d.CLOSED === 'N') {
        map[uId].activeCount += 1;
      }
    });

    // Process activities
    activities.forEach(a => {
      const uId = a.RESPONSIBLE_ID;
      if (!uId) return;
      if (!map[uId]) {
        map[uId] = { id: uId, name: getUserName(uId, users), wonSum: 0, wonCount: 0, activeCount: 0, actsCount: 0 };
      }
      map[uId].actsCount += 1;
    });

    return Object.values(map).sort((a,b) => b.wonSum - a.wonSum);
  }, [deals, users, activities, loading]);

  const exportCols = [
    { header: "ID Сотрудника", key: "id" },
    { header: "Имя", key: "name" },
    { header: "Выручка (Сумма)", key: "wonSum" },
    { header: "Сделок (успех)", key: "wonCount" },
    { header: "Сделок (в работе)", key: "activeCount" },
    { header: "Кол-во активностей", key: "actsCount" }
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Эффективность менеджеров</h1>
          <p className="text-white/40 text-sm">Рейтинг сотрудников по KPI</p>
        </div>
        <ExportButton data={managerStats} columns={exportCols} filename="managers_kpi" disabled={loading} />
      </div>

      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
          <Trophy className="text-amber-400" size={18} /> Рейтинг продаж
        </h3>
        
        <div className="overflow-x-auto">
          {loading ? (
             <div className="py-10 flex items-center justify-center"><Loader2 className="animate-spin text-white/30" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">#</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Сотрудник</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Сумма выигранных</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Сделки (win/active)</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Активности</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {managerStats.map((mgr, i) => (
                  <tr key={mgr.id} className="hover:bg-white/3 transition-colors">
                    <td className={`py-4 px-2 font-bold ${i < 3 ? 'text-amber-400' : 'text-white/30'}`}>{i + 1}</td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                          {mgr.name.slice(0, 2)}
                        </div>
                        <span className="text-white/90 font-medium">{mgr.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-green-400 font-bold">
                      {Math.round(mgr.wonSum).toLocaleString()} ₽
                    </td>
                    <td className="py-4 px-2 text-white/60">
                      <span className="text-green-400">{mgr.wonCount}</span> 
                      <span className="opacity-40 mx-1">/</span> 
                      <span className="text-blue-400">{mgr.activeCount}</span>
                    </td>
                    <td className="py-4 px-2 text-white/60 flex items-center gap-2">
                      <PhoneCall size={14} className="text-violet-400"/> {mgr.actsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
