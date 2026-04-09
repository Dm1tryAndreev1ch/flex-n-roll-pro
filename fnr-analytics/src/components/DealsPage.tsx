import React, { useState } from "react";
import { Filter, Search, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBitrixDeals } from "../hooks/useBitrix";
import ExportButton from "./ExportButton";
import { getStageInfo } from "../utils/constants";
import { ColumnDefinition } from "../utils/exportExcel";

export default function DealsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { deals, loading, error, refetch } = useBitrixDeals({
    // Optional default filters
    // ">=DATE_CREATE": new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString()
  });

  const filteredDeals = deals.filter(d => 
    (d.TITLE && d.TITLE.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (d.ID && d.ID.toString().includes(searchTerm))
  );

  // Prepare data for funnel/pipeline chart
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

  const exportColumns: ColumnDefinition[] = [
    { header: "ID", key: "ID" },
    { header: "Название сделки", key: "TITLE", width: 40 },
    { header: "Стадия", key: "STAGE_ID", formatter: (val) => getStageInfo(val).label },
    { header: "Сумма", key: "OPPORTUNITY", formatter: (val, row) => `${val || 0} ${row.CURRENCY_ID || 'RUB'}` },
    { header: "Дата создания", key: "DATE_CREATE", formatter: (val) => new Date(val).toLocaleDateString() },
    { header: "Ответственный (ID)", key: "ASSIGNED_BY_ID" },
    { header: "Компания (ID)", key: "COMPANY_ID" }
  ];

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
            columns={exportColumns} 
            filename="deals_export" 
            disabled={loading || !!error}
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
