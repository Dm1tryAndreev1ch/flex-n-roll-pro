import { useMemo } from "react";
import { Loader2, DollarSign, Target, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBitrixDeals } from "../hooks/useBitrix";
import { getStageInfo } from "../utils/constants";
import ExportButton from "./ExportButton";
import type { SheetDefinition } from "../utils/exportExcel";

export default function FinanceReportPage() {
  const { deals, loading, error } = useBitrixDeals();

  const financeData = useMemo(() => {
    if (!deals.length) return { metrics: { won: 0, active: 0, avgCheck: 0, maxCheck: 0 }, chartData: [], dealDetails: [] };

    let totalWon = 0;
    let totalActive = 0;
    let maxCheck = 0;
    
    const monthsMap: Record<string, { revenue: number; count: number; deals: string[] }> = {};
    const dealDetails: any[] = [];

    deals.forEach(d => {
      const stage = getStageInfo(d.STAGE_ID);
      const amount = parseFloat(d.OPPORTUNITY || 0);

      if (stage.color === 'green') {
        totalWon += amount;
        if (amount > maxCheck) maxCheck = amount;
        
        const date = new Date(d.DATE_CREATE);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthsMap[monthKey]) monthsMap[monthKey] = { revenue: 0, count: 0, deals: [] };
        monthsMap[monthKey].revenue += amount;
        monthsMap[monthKey].count += 1;
        monthsMap[monthKey].deals.push(d.TITLE || d.ID);

        dealDetails.push({
          id: d.ID,
          title: d.TITLE,
          amount,
          currency: d.CURRENCY_ID || 'RUB',
          dateCreate: d.DATE_CREATE,
          dateModify: d.DATE_MODIFY,
          assignedTo: d.ASSIGNED_BY_ID,
        });
      } else if (d.CLOSED === 'N') {
        totalActive += amount;
      }
    });

    const wonCount = dealDetails.length;
    const avgCheck = wonCount > 0 ? (totalWon / wonCount) : 0;

    const chartData = Object.keys(monthsMap)
      .sort()
      .map(key => ({
        month: key,
        revenue: monthsMap[key].revenue,
        count: monthsMap[key].count,
        avgCheck: monthsMap[key].count ? Math.round(monthsMap[key].revenue / monthsMap[key].count) : 0,
      }));

    return {
      metrics: { won: totalWon, active: totalActive, avgCheck, maxCheck },
      chartData,
      dealDetails,
    };
  }, [deals]);

  const { metrics, chartData, dealDetails } = financeData;

  // ── Multi-sheet export ──
  const exportSheets: SheetDefinition[] = useMemo(() => [
    // Sheet 1: Financial summary by month
    {
      name: "Выручка по месяцам",
      columns: [
        { header: "Период", key: "month", width: 12 },
        { header: "Выручка (₽)", key: "revenue", width: 18, formatter: (v: any) => Math.round(v) },
        { header: "Кол-во сделок", key: "count", width: 14 },
        { header: "Средний чек (₽)", key: "avgCheck", width: 16, formatter: (v: any) => Math.round(v) },
        { header: "Нарастающий итог", key: "cumulative", width: 18 },
      ],
      data: (() => {
        let cumulative = 0;
        return chartData.map(m => {
          cumulative += m.revenue;
          return { ...m, cumulative: Math.round(cumulative) };
        });
      })(),
      summaryRows: [
        {
          month: "ИТОГО:",
          revenue: Math.round(metrics.won),
          count: dealDetails.length,
          avgCheck: Math.round(metrics.avgCheck),
          cumulative: Math.round(metrics.won),
        }
      ],
    },
    // Sheet 2: Detailed won deals
    {
      name: "Закрытые сделки",
      columns: [
        { header: "ID", key: "id", width: 8 },
        { header: "Название", key: "title", width: 40 },
        { header: "Сумма", key: "amount", width: 15, formatter: (v: any) => parseFloat(v || 0) },
        { header: "Валюта", key: "currency", width: 8 },
        { header: "Дата создания", key: "dateCreate", width: 18, formatter: (v: any) => v ? new Date(v).toLocaleDateString('ru-RU') : '' },
        { header: "Дата закрытия", key: "dateModify", width: 18, formatter: (v: any) => v ? new Date(v).toLocaleDateString('ru-RU') : '' },
        { header: "Цикл (дни)", key: "cycle", width: 12, formatter: (_: any, row: any) => {
          if (!row.dateCreate || !row.dateModify) return '';
          const diff = new Date(row.dateModify).getTime() - new Date(row.dateCreate).getTime();
          return Math.round(diff / (1000 * 60 * 60 * 24));
        }},
        { header: "Ответственный (ID)", key: "assignedTo", width: 16 },
      ],
      data: dealDetails.sort((a, b) => b.amount - a.amount),
      summaryRows: [
        {
          id: "ИТОГО:",
          title: `${dealDetails.length} сделок`,
          amount: metrics.won,
          currency: "",
          dateCreate: "",
          dateModify: `Средний чек: ${Math.round(metrics.avgCheck)}`,
          cycle: "",
          assignedTo: "",
        }
      ],
    },
    // Sheet 3: KPI overview
    {
      name: "Ключевые показатели",
      columns: [
        { header: "Показатель", key: "metric", width: 30 },
        { header: "Значение", key: "value", width: 20 },
        { header: "Комментарий", key: "comment", width: 35 },
      ],
      data: [
        { metric: "Фактическая выручка", value: `${Math.round(metrics.won).toLocaleString()} ₽`, comment: "Сумма всех успешных сделок" },
        { metric: "Ожидаемая выручка", value: `${Math.round(metrics.active).toLocaleString()} ₽`, comment: "Сумма сделок в работе" },
        { metric: "Средний чек", value: `${Math.round(metrics.avgCheck).toLocaleString()} ₽`, comment: "Среднее по закрытым сделкам" },
        { metric: "Максимальный чек", value: `${Math.round(metrics.maxCheck).toLocaleString()} ₽`, comment: "Самая крупная сделка" },
        { metric: "Всего закрыто сделок", value: String(dealDetails.length), comment: "" },
        { metric: "Всего сделок в системе", value: String(deals.length), comment: "" },
        { metric: "Конверсия (%)", value: deals.length ? `${Math.round((dealDetails.length / deals.length) * 100)}%` : "0%", comment: "Закрытые / Всего * 100" },
        { metric: "", value: "", comment: "" },
        { metric: "Дата отчёта", value: new Date().toLocaleDateString('ru-RU') + ' ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), comment: "FLEX-N-ROLL PRO Analytics" },
      ],
    },
  ], [chartData, dealDetails, deals, metrics]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Финансовая аналитика</h1>
          <p className="text-white/40 text-sm">Выручка и динамика чека</p>
        </div>
        <ExportButton data={[]} columns={[]} sheets={exportSheets} filename="finance_report" disabled={loading} label="Фин. отчёт (3 листа)" />
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
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }} 
                formatter={(value: any) => {
                  const num = typeof value === 'number' ? value : parseFloat(value || '0');
                  return [`${num.toLocaleString('ru-RU')} ₽`, 'Сумма'];
                }}
              />
              <Bar dataKey="revenue" name="Выручка" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
