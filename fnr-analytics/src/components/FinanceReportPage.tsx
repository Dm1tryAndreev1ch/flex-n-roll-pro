import React, { useMemo } from "react";
import { Loader2, DollarSign, Target, TrendingUp } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBitrixDeals } from "../hooks/useBitrix";
import { getStageInfo } from "../utils/constants";
import ExportButton from "./ExportButton";

export default function FinanceReportPage() {
  const { deals, loading, error } = useBitrixDeals();

  const financeData = useMemo(() => {
    if (!deals.length) return { metrics: { won: 0, active: 0, avgCheck: 0 }, chartData: [] };

    let totalWon = 0;
    let totalActive = 0;
    let maxCheck = 0;
    
    // Group won deals by Month
    const monthsMap: Record<string, number> = {};

    deals.forEach(d => {
      const stage = getStageInfo(d.STAGE_ID);
      const amount = parseFloat(d.OPPORTUNITY || 0);

      if (stage.color === 'green') {
        totalWon += amount;
        if (amount > maxCheck) maxCheck = amount;
        
        const date = new Date(d.DATE_CREATE);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthsMap[monthKey] = (monthsMap[monthKey] || 0) + amount;
      } else if (d.CLOSED === 'N') {
        totalActive += amount;
      }
    });

    const wonCount = deals.filter(d => getStageInfo(d.STAGE_ID).color === 'green').length;
    const avgCheck = wonCount > 0 ? (totalWon / wonCount) : 0;

    // Convert map to sorted array
    const chartData = Object.keys(monthsMap)
      .sort()
      .map(key => ({
        name: key, // "2024-03"
        Выручка: monthsMap[key]
      }));

    return {
      metrics: {
        won: totalWon,
        active: totalActive,
        avgCheck,
        maxCheck
      },
      chartData
    };
  }, [deals]);

  const { metrics, chartData } = financeData;

  const exportCols = [
    { header: "Период", key: "name" },
    { header: "Выручка", key: "Выручка" }
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Финансовая аналитика</h1>
          <p className="text-white/40 text-sm">Выручка и динамика чека</p>
        </div>
        <ExportButton data={chartData} columns={exportCols} filename="finance_months" disabled={loading} />
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-500 p-4 rounded-xl">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[ 
          { label: "Фактическая выручка", val: metrics.won, icon: <DollarSign size={20}/>, c: "green" },
          { label: "Ожидаемая выручка", val: metrics.active, icon: <TrendingUp size={20}/>, c: "blue" },
          { label: "Средний чек", val: metrics.avgCheck, icon: <Target size={20}/>, c: "violet" },
          { label: "Максимальный чек", val: metrics.maxCheck, icon: <DollarSign size={20}/>, c: "amber" },
        ].map((item, i) => (
          <div key={i} className={`bg-gradient-to-br from-${item.c}-500/10 to-${item.c}-600/5 border border-${item.c}-500/20 rounded-2xl p-5`}>
            <div className={`w-10 h-10 rounded-xl bg-${item.c}-500/20 flex items-center justify-center text-${item.c}-400 mb-3`}>
              {item.icon}
            </div>
            {loading ? <div className="h-8 w-24 bg-white/10 animate-pulse rounded" /> : (
              <p className="text-2xl font-bold text-white mb-1">
                {Math.round(item.val).toLocaleString()} <span className="text-sm font-normal text-white/50">₽</span>
              </p>
            )}
            <p className="text-white/50 text-sm">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-6">Динамика выручки (по месяцам закрытия)</h3>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white/20" /></div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }} 
                formatter={(value: number) => [`${value.toLocaleString()} ₽`, 'Выручка']}
              />
              <Bar dataKey="Выручка" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
