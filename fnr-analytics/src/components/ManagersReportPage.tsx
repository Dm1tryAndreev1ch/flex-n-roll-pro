import { useMemo } from "react";
import { Loader2, Trophy, PhoneCall } from "lucide-react";
import { useBitrixDeals, useBitrixUsers, useBitrixActivities } from "../hooks/useBitrix";
import { getStageInfo, getUserName } from "../utils/constants";
import ExportButton from "./ExportButton";
import type { SheetDefinition } from "../utils/exportExcel";

export default function ManagersReportPage() {
  const { deals, loading: dLoad } = useBitrixDeals();
  const { users, loading: uLoad } = useBitrixUsers();
  const { activities, loading: aLoad } = useBitrixActivities();

  const loading = dLoad || uLoad || aLoad;

  const managerStats = useMemo(() => {
    if (loading) return [];
    
    const map: Record<string, any> = {};

    deals.forEach(d => {
      const uId = d.ASSIGNED_BY_ID;
      if (!uId) return;

      if (!map[uId]) {
        map[uId] = {
          id: uId, name: getUserName(uId, users),
          wonSum: 0, wonCount: 0, activeCount: 0, lostCount: 0,
          actsCount: 0, callsCount: 0, emailsCount: 0,
          totalDeals: 0, avgCycle: 0, cycleDays: [],
        };
      }

      map[uId].totalDeals++;
      const stage = getStageInfo(d.STAGE_ID);

      if (stage.color === 'green') {
        map[uId].wonSum += parseFloat(d.OPPORTUNITY || 0);
        map[uId].wonCount += 1;
        // Calculate deal cycle
        if (d.DATE_CREATE && d.DATE_MODIFY) {
          const diff = new Date(d.DATE_MODIFY).getTime() - new Date(d.DATE_CREATE).getTime();
          map[uId].cycleDays.push(Math.round(diff / (1000 * 60 * 60 * 24)));
        }
      } else if (stage.color === 'red') {
        map[uId].lostCount += 1;
      } else if (d.CLOSED === 'N') {
        map[uId].activeCount += 1;
      }
    });

    activities.forEach(a => {
      const uId = a.RESPONSIBLE_ID;
      if (!uId) return;
      if (!map[uId]) {
        map[uId] = {
          id: uId, name: getUserName(uId, users),
          wonSum: 0, wonCount: 0, activeCount: 0, lostCount: 0,
          actsCount: 0, callsCount: 0, emailsCount: 0,
          totalDeals: 0, cycleDays: [],
        };
      }
      map[uId].actsCount += 1;
      if (a.PROVIDER_ID === 'CALL' || a.TYPE_ID === '2') map[uId].callsCount += 1;
      if (a.PROVIDER_ID === 'EMAIL' || a.TYPE_ID === '4') map[uId].emailsCount += 1;
    });

    // Compute averages
    return Object.values(map).map((m: any) => ({
      ...m,
      avgCheck: m.wonCount ? Math.round(m.wonSum / m.wonCount) : 0,
      conversion: m.totalDeals ? Math.round((m.wonCount / m.totalDeals) * 100) : 0,
      avgCycle: m.cycleDays.length ? Math.round(m.cycleDays.reduce((s: number, d: number) => s + d, 0) / m.cycleDays.length) : 0,
    })).sort((a: any, b: any) => b.wonSum - a.wonSum);
  }, [deals, users, activities, loading]);

  // ── Multi-sheet export ──
  const exportSheets: SheetDefinition[] = useMemo(() => {
    const totals = managerStats.reduce((acc, m) => ({
      wonSum: acc.wonSum + m.wonSum,
      wonCount: acc.wonCount + m.wonCount,
      activeCount: acc.activeCount + m.activeCount,
      lostCount: acc.lostCount + m.lostCount,
      actsCount: acc.actsCount + m.actsCount,
      callsCount: acc.callsCount + m.callsCount,
      emailsCount: acc.emailsCount + m.emailsCount,
      totalDeals: acc.totalDeals + m.totalDeals,
    }), { wonSum: 0, wonCount: 0, activeCount: 0, lostCount: 0, actsCount: 0, callsCount: 0, emailsCount: 0, totalDeals: 0 });

    return [
      // Sheet 1: KPI Overview
      {
        name: "KPI менеджеров",
        columns: [
          { header: "Место", key: "rank", width: 7 },
          { header: "ID", key: "id", width: 8 },
          { header: "Менеджер", key: "name", width: 25 },
          { header: "Выручка (₽)", key: "wonSum", width: 16, formatter: (v: any) => Math.round(v) },
          { header: "Сделок (успех)", key: "wonCount", width: 14 },
          { header: "Сделок (в работе)", key: "activeCount", width: 16 },
          { header: "Сделок (проиграно)", key: "lostCount", width: 17 },
          { header: "Всего сделок", key: "totalDeals", width: 14 },
          { header: "Конверсия (%)", key: "conversion", width: 14 },
          { header: "Средний чек (₽)", key: "avgCheck", width: 16, formatter: (v: any) => Math.round(v) },
          { header: "Ср. цикл (дни)", key: "avgCycle", width: 14 },
        ],
        data: managerStats.map((m, i) => ({ ...m, rank: i + 1 })),
        summaryRows: [
          {
            rank: "",
            id: "ИТОГО:",
            name: `${managerStats.length} менеджеров`,
            wonSum: totals.wonSum,
            wonCount: totals.wonCount,
            activeCount: totals.activeCount,
            lostCount: totals.lostCount,
            totalDeals: totals.totalDeals,
            conversion: totals.totalDeals ? Math.round((totals.wonCount / totals.totalDeals) * 100) : 0,
            avgCheck: totals.wonCount ? Math.round(totals.wonSum / totals.wonCount) : 0,
            avgCycle: "",
          }
        ]
      },
      // Sheet 2: Activity breakdown
      {
        name: "Активности по менеджерам",
        columns: [
          { header: "Менеджер", key: "name", width: 25 },
          { header: "Всего активностей", key: "actsCount", width: 18 },
          { header: "Звонки", key: "callsCount", width: 10 },
          { header: "Письма", key: "emailsCount", width: 10 },
          { header: "Прочее", key: "otherCount", width: 10, formatter: (_: any, row: any) => row.actsCount - row.callsCount - row.emailsCount },
          { header: "Активностей на сделку", key: "actPerDeal", width: 20, formatter: (_: any, row: any) => row.totalDeals ? (row.actsCount / row.totalDeals).toFixed(1) : '0' },
          { header: "Выручка на активность", key: "revPerAct", width: 22, formatter: (_: any, row: any) => row.actsCount ? Math.round(row.wonSum / row.actsCount) : 0 },
        ],
        data: managerStats.filter(m => m.actsCount > 0).sort((a, b) => b.actsCount - a.actsCount),
        summaryRows: [
          {
            name: "ИТОГО:",
            actsCount: totals.actsCount,
            callsCount: totals.callsCount,
            emailsCount: totals.emailsCount,
            otherCount: totals.actsCount - totals.callsCount - totals.emailsCount,
            actPerDeal: totals.totalDeals ? (totals.actsCount / totals.totalDeals).toFixed(1) : '0',
            revPerAct: totals.actsCount ? Math.round(totals.wonSum / totals.actsCount) : 0,
          },
        ],
      },
      // Sheet 3: Efficiency ranking
      {
        name: "Рейтинг эффективности",
        columns: [
          { header: "Место", key: "rank", width: 7 },
          { header: "Менеджер", key: "name", width: 25 },
          { header: "Конверсия (%)", key: "conversion", width: 14 },
          { header: "Выручка (₽)", key: "wonSum", width: 16, formatter: (v: any) => Math.round(v) },
          { header: "Средний чек (₽)", key: "avgCheck", width: 16, formatter: (v: any) => Math.round(v) },
          { header: "Ср. цикл (дни)", key: "avgCycle", width: 14 },
          { header: "Оценка", key: "score", width: 10, formatter: (_: any, row: any) => {
            // Simple scoring: conversion * 0.4 + volume * 0.3 + efficiency * 0.3
            const maxWon = Math.max(...managerStats.map(m => m.wonSum), 1);
            const maxConv = Math.max(...managerStats.map(m => m.conversion), 1);
            const score = ((row.conversion / maxConv) * 40 + (row.wonSum / maxWon) * 30 + (row.avgCycle > 0 ? (30 / row.avgCycle) * 10 : 15)).toFixed(0);
            return `${score}/100`;
          }},
        ],
        data: [...managerStats]
          .sort((a, b) => b.conversion - a.conversion || b.wonSum - a.wonSum)
          .map((m, i) => ({ ...m, rank: i + 1 })),
      },
    ];
  }, [managerStats, deals]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Эффективность менеджеров</h1>
          <p className="text-white/40 text-sm">Рейтинг сотрудников по KPI</p>
        </div>
        <ExportButton data={[]} columns={[]} sheets={exportSheets} filename="managers_kpi" disabled={loading} label="KPI отчёт (3 листа)" />
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
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Выручка</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Сделки (win/active/lost)</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Конверсия</th>
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
                      <span className="opacity-40 mx-1">/</span> 
                      <span className="text-red-400">{mgr.lostCount}</span>
                    </td>
                    <td className="py-4 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        mgr.conversion >= 50 ? 'bg-green-500/15 text-green-400' : 
                        mgr.conversion >= 25 ? 'bg-amber-500/15 text-amber-400' : 
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {mgr.conversion}%
                      </span>
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
