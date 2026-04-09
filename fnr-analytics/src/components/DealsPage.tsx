import { useState, useMemo } from "react";
import { Filter, Search, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBitrixDeals } from "../hooks/useBitrix";
import ExportButton from "./ExportButton";
import { getStageInfo } from "../utils/constants";
import type { SheetDefinition } from "../utils/exportExcel";

export default function DealsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { deals, loading, error, refetch } = useBitrixDeals({});

  const filteredDeals = deals.filter(d => 
    (d.TITLE && d.TITLE.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (d.ID && d.ID.toString().includes(searchTerm))
  );

  // Stage distribution for chart
  const stageDataMap: Record<string, { name: string, count: number, originalId: string }> = {};
  filteredDeals.forEach(d => {
    if (!stageDataMap[d.STAGE_ID]) {
      stageDataMap[d.STAGE_ID] = { 
        name: getStageInfo(d.STAGE_ID).label, 
        count: 0,
        originalId: d.STAGE_ID 
      };
    }
    stageDataMap[d.STAGE_ID].count += 1;
  });
  const chartData = Object.values(stageDataMap).sort((a,b) => b.count - a.count);

  // ── Rich Excel export (3 sheets) ──
  const exportSheets: SheetDefinition[] = useMemo(() => {
    const totalAmount = filteredDeals.reduce((s, d) => s + parseFloat(d.OPPORTUNITY || 0), 0);
    const wonDeals = filteredDeals.filter(d => getStageInfo(d.STAGE_ID).color === 'green');
    const activeDeals = filteredDeals.filter(d => d.CLOSED === 'N');

    return [
      // Sheet 1: All deals
      {
        name: "Все сделки",
        columns: [
          { header: "ID", key: "ID", width: 8 },
          { header: "Название сделки", key: "TITLE", width: 40 },
          { header: "Стадия (код)", key: "STAGE_ID", width: 20 },
          { header: "Стадия", key: "STAGE_LABEL", width: 22, formatter: (_: any, row: any) => getStageInfo(row.STAGE_ID).label },
          { header: "Статус", key: "STATUS", formatter: (_: any, row: any) => {
            const c = getStageInfo(row.STAGE_ID).color;
            return c === 'green' ? 'Успех' : c === 'red' ? 'Провал' : 'В работе';
          }},
          { header: "Сумма", key: "OPPORTUNITY", width: 15, formatter: (v: any) => parseFloat(v || 0) },
          { header: "Валюта", key: "CURRENCY_ID", width: 8 },
          { header: "Дата создания", key: "DATE_CREATE", width: 18, formatter: (v: any) => v ? new Date(v).toLocaleDateString('ru-RU') + ' ' + new Date(v).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '' },
          { header: "Дата изменения", key: "DATE_MODIFY", width: 18, formatter: (v: any) => v ? new Date(v).toLocaleDateString('ru-RU') : '' },
          { header: "Закрыта", key: "CLOSED", width: 8, formatter: (v: any) => v === 'Y' ? 'Да' : 'Нет' },
          { header: "Ответственный (ID)", key: "ASSIGNED_BY_ID", width: 15 },
          { header: "Контакт (ID)", key: "CONTACT_ID", width: 12 },
          { header: "Компания (ID)", key: "COMPANY_ID", width: 13 },
        ],
        data: filteredDeals,
        summaryRows: [
          {
            ID: "ИТОГО:",
            TITLE: `${filteredDeals.length} сделок`,
            STAGE_LABEL: `Успешных: ${wonDeals.length}`,
            STATUS: `В работе: ${activeDeals.length}`,
            OPPORTUNITY: totalAmount,
            CURRENCY_ID: "",
            DATE_CREATE: `Экспорт: ${new Date().toLocaleDateString('ru-RU')}`,
          }
        ]
      },
      // Sheet 2: Stage summary
      {
        name: "По стадиям",
        columns: [
          { header: "Стадия", key: "name", width: 25 },
          { header: "Количество сделок", key: "count", width: 18 },
          { header: "Доля (%)", key: "share", width: 12, formatter: (v: any) => `${v}%` },
          { header: "Общая сумма", key: "amount", width: 18, formatter: (v: any) => parseFloat(v || 0) },
          { header: "Средний чек", key: "avg", width: 15, formatter: (v: any) => Math.round(parseFloat(v || 0)) },
        ],
        data: Object.entries(
          filteredDeals.reduce<Record<string, { count: number; total: number }>>((acc, d) => {
            const stage = getStageInfo(d.STAGE_ID).label;
            if (!acc[stage]) acc[stage] = { count: 0, total: 0 };
            acc[stage].count++;
            acc[stage].total += parseFloat(d.OPPORTUNITY || 0);
            return acc;
          }, {})
        ).map(([name, v]) => ({
          name,
          count: v.count,
          share: filteredDeals.length ? Math.round((v.count / filteredDeals.length) * 100) : 0,
          amount: v.total,
          avg: v.count ? v.total / v.count : 0,
        })).sort((a, b) => b.count - a.count),
        summaryRows: [
          { name: "ИТОГО:", count: filteredDeals.length, share: "100%", amount: totalAmount, avg: filteredDeals.length ? totalAmount / filteredDeals.length : 0 }
        ],
      },
      // Sheet 3: Monthly dynamics
      {
        name: "Динамика по месяцам",
        columns: [
          { header: "Месяц", key: "month", width: 12 },
          { header: "Создано сделок", key: "created", width: 15 },
          { header: "Сумма созданных", key: "createdAmount", width: 18 },
          { header: "Закрыто успешно", key: "won", width: 15 },
          { header: "Сумма выигранных", key: "wonAmount", width: 18 },
          { header: "Проиграно", key: "lost", width: 12 },
          { header: "Конверсия (%)", key: "conversion", width: 14 },
        ],
        data: (() => {
          const months: Record<string, { created: number; createdAmount: number; won: number; wonAmount: number; lost: number }> = {};
          filteredDeals.forEach(d => {
            const date = new Date(d.DATE_CREATE);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!months[key]) months[key] = { created: 0, createdAmount: 0, won: 0, wonAmount: 0, lost: 0 };
            months[key].created++;
            months[key].createdAmount += parseFloat(d.OPPORTUNITY || 0);
            const stage = getStageInfo(d.STAGE_ID);
            if (stage.color === 'green') { months[key].won++; months[key].wonAmount += parseFloat(d.OPPORTUNITY || 0); }
            if (stage.color === 'red') months[key].lost++;
          });
          return Object.keys(months).sort().map(month => ({
            month,
            ...months[month],
            conversion: months[month].created ? Math.round((months[month].won / months[month].created) * 100) : 0,
          }));
        })(),
      }
    ];
  }, [filteredDeals]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Сделки CRM</h1>
          <p className="text-white/40 text-sm">Данные напрямую из Bitrix24</p>
        </div>
        <div className="flex items-center gap-2">
           <ExportButton 
            data={filteredDeals} 
            columns={[]} 
            filename="deals_report" 
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

      {/* Chart */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-1">Распределение сделок по стадиям</h3>
        <p className="text-white/30 text-xs mb-5">Количество сделок в каждой воронке (отфильтрованных)</p>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="animate-spin text-white/30" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
               <defs>
                <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }}
              />
              <Area type="monotone" dataKey="count" name="Сделок" stroke="#3b82f6" strokeWidth={2} fill="url(#gBlue)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Table */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              Список сделок
              {!loading && <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{filteredDeals.length}</span>}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Поиск по названию или ID..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <button onClick={refetch} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 transition-colors">
              <Filter size={18} />
            </button>
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
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Название</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Стадия</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Сумма</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {filteredDeals.map((deal) => {
                  const stage = getStageInfo(deal.STAGE_ID);
                  return (
                    <tr key={deal.ID} className="hover:bg-white/3 transition-colors group">
                      <td className="py-3 px-2 text-white/40 font-mono text-xs">{deal.ID}</td>
                      <td className="py-3 px-2 text-white/90 font-medium">{deal.TITLE || `Сделка #${deal.ID}`}</td>
                      <td className="py-3 px-2">
                         <span className={`px-2 py-0.5 rounded-lg text-xs bg-${stage.color}-500/15 text-${stage.color}-400`}>
                          {stage.label}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-white/80 font-medium text-xs">
                        {parseFloat(deal.OPPORTUNITY || 0).toLocaleString("ru-RU")} {deal.CURRENCY_ID}
                      </td>
                      <td className="py-3 px-2 text-white/50 text-xs">
                        {new Date(deal.DATE_CREATE).toLocaleDateString("ru-RU")}
                      </td>
                    </tr>
                  );
                })}
                {filteredDeals.length === 0 && (
                   <tr>
                    <td colSpan={5} className="py-10 text-center text-white/30">Сделок не найдено</td>
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
