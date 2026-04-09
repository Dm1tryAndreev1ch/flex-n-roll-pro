import React, { useState, useMemo } from "react";
import { Search, Loader2 } from "lucide-react";
import { useBitrixContacts, useBitrixCompanies } from "../hooks/useBitrix";
import ExportButton from "./ExportButton";
import type { SheetDefinition } from "../utils/exportExcel";

export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState<"contacts" | "companies">("contacts");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { contacts, loading: loadingContacts, error: errorContacts } = useBitrixContacts({});
  // Add select param to ensure we fetch all relevant fields for export
  const { companies, loading: loadingCompanies, error: errorCompanies } = useBitrixCompanies({});

  const filteredContacts = contacts.filter(c => 
    (c.NAME && c.NAME.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.LAST_NAME && c.LAST_NAME.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.PHONE && c.PHONE.some((p: any) => p.VALUE.includes(searchTerm))) ||
    (c.EMAIL && c.EMAIL.some((e: any) => e.VALUE.includes(searchTerm)))
  );

  const filteredCompanies = companies.filter(c => 
    (c.TITLE && c.TITLE.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ── Multi-sheet export ──
  const exportSheetsContacts: SheetDefinition[] = useMemo(() => [
    {
      name: "Все Контакты",
      columns: [
        { header: "ID", key: "ID", width: 8 },
        { header: "Имя Фамилия", key: "FULL_NAME", width: 30, formatter: (_: any, row: any) => `${row.NAME || ''} ${row.LAST_NAME || ''}`.trim() },
        { header: "Имя", key: "NAME", width: 15 },
        { header: "Фамилия", key: "LAST_NAME", width: 15 },
        { header: "Отчество", key: "SECOND_NAME", width: 15 },
        { header: "Должность", key: "POST", width: 20 },
        { header: "Телефоны", key: "PHONE", width: 25, formatter: (val) => val && val.length ? val.map((p: any) => p.VALUE).join(', ') : '' },
        { header: "Email", key: "EMAIL", width: 25, formatter: (val) => val && val.length ? val.map((e: any) => e.VALUE).join(', ') : '' },
        { header: "Компания (ID)", key: "COMPANY_ID", width: 15 },
        { header: "Дата создания", key: "DATE_CREATE", width: 18, formatter: (val) => val ? new Date(val).toLocaleDateString('ru-RU') : '' },
      ],
      data: filteredContacts,
      summaryRows: [
        { ID: "ИТОГО:", FULL_NAME: `${filteredContacts.length} контактов` }
      ]
    }
  ], [filteredContacts]);

  const exportSheetsCompanies: SheetDefinition[] = useMemo(() => {
    // Generate type breakdown
    const typeCounts: Record<string, number> = {};
    const revenueStats: Record<string, { count: number; sum: number }> = {};
    
    filteredCompanies.forEach(c => {
        const type = c.COMPANY_TYPE || "Не указан";
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        
        if (!revenueStats[type]) revenueStats[type] = { count: 0, sum: 0 };
        revenueStats[type].count++;
        revenueStats[type].sum += parseFloat(c.REVENUE || 0);
    });

    return [
      // Sheet 1: All Companies
      {
        name: "Все Компании",
        columns: [
          { header: "ID", key: "ID", width: 8 },
          { header: "Название компании", key: "TITLE", width: 40 },
          { header: "Тип", key: "COMPANY_TYPE", width: 20 },
          { header: "Сфера деятельности", key: "INDUSTRY", width: 20 },
          { header: "Выручка (₽)", key: "REVENUE", width: 18, formatter: (v: any) => parseFloat(v || 0) },
          { header: "Дата создания", key: "DATE_CREATE", width: 18, formatter: (val) => val ? new Date(val).toLocaleDateString('ru-RU') : '' },
          { header: "Ответственный (ID)", key: "ASSIGNED_BY_ID", width: 18 },
        ],
        data: filteredCompanies,
        summaryRows: [
          { 
              ID: "ИТОГО:", 
              TITLE: `${filteredCompanies.length} компаний`,
              REVENUE: filteredCompanies.reduce((sum, c) => sum + parseFloat(c.REVENUE || 0), 0)
          }
        ]
      },
      // Sheet 2: Stats by Type
      {
         name: "Сводка по типам",
         columns: [
             { header: "Тип компании", key: "type", width: 25 },
             { header: "Количество", key: "count", width: 15 },
             { header: "Общая выручка", key: "revenue", width: 20 },
             { header: "Средняя выручка", key: "avg", width: 20, formatter: (_:any, row: any) => row.count ? Math.round(row.revenue / row.count) : 0 },
         ],
         data: Object.keys(revenueStats).map(type => ({
             type,
             count: revenueStats[type].count,
             revenue: revenueStats[type].sum,
         })).sort((a, b) => b.count - a.count)
      }
    ];
  }, [filteredCompanies]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Моя Клиентская База</h1>
          <p className="text-white/40 text-sm">Контакты и компании из Bitrix24</p>
        </div>
        <div className="flex items-center gap-2">
           <ExportButton 
            data={[]} 
            columns={[]} 
            filename={`${activeTab}_report`} 
            disabled={(activeTab === 'contacts' ? loadingContacts : loadingCompanies)}
            sheets={activeTab === 'contacts' ? exportSheetsContacts : exportSheetsCompanies}
            label={activeTab === 'contacts' ? "Export Contacts" : "Export Companies (2 листа)"}
          />
        </div>
      </div>

      {(errorContacts || errorCompanies) && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
          Ошибка загрузки данных: {errorContacts || errorCompanies}
        </div>
      )}

      {/* Toggles */}
      <div className="flex gap-4 border-b border-white/10 mb-6">
        <button 
          onClick={() => setActiveTab("contacts")}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'contacts' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-white/50 hover:text-white/80'}`}
        >
          Контакты {!loadingContacts && `(${contacts.length})`}
        </button>
        <button 
          onClick={() => setActiveTab("companies")}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'companies' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-white/50 hover:text-white/80'}`}
        >
          Компании {!loadingCompanies && `(${companies.length})`}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="relative w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
             <input 
              type="text" 
              placeholder="Поиск..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-blue-500/50"
             />
          </div>
        </div>

        <div className="overflow-x-auto">
          {(activeTab === 'contacts' && loadingContacts) || (activeTab === 'companies' && loadingCompanies) ? (
             <div className="py-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-white/30" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">ID</th>
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Имя / Название</th>
                  {activeTab === 'contacts' && <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Контакты</th>}
                  {activeTab === 'companies' && <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Тип / Выручка</th>}
                  <th className="text-left text-white/30 font-medium pb-3 px-2 text-xs">Дата создания</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                
                {activeTab === 'contacts' && filteredContacts.map((c) => (
                  <tr key={c.ID} className="hover:bg-white/3 transition-colors">
                     <td className="py-3 px-2 text-white/40 font-mono text-xs">{c.ID}</td>
                     <td className="py-3 px-2 text-white/90 font-medium">{c.NAME} {c.LAST_NAME}</td>
                     <td className="py-3 px-2 text-white/50 text-xs space-y-1">
                        {c.PHONE && c.PHONE.map((p: any, i: number) => <div key={i}>📞 {p.VALUE}</div>)}
                        {c.EMAIL && c.EMAIL.map((e: any, i: number) => <div key={i}>✉️ {e.VALUE}</div>)}
                     </td>
                     <td className="py-3 px-2 text-white/50 text-xs">
                       {new Date(c.DATE_CREATE).toLocaleDateString("ru-RU")}
                     </td>
                  </tr>
                ))}

                {activeTab === 'companies' && filteredCompanies.map((c) => (
                  <tr key={c.ID} className="hover:bg-white/3 transition-colors">
                     <td className="py-3 px-2 text-white/40 font-mono text-xs">{c.ID}</td>
                     <td className="py-3 px-2 text-white/90 font-medium">{c.TITLE}</td>
                     <td className="py-3 px-2 text-white/50 text-xs">
                        <div>{c.COMPANY_TYPE || 'Не указан'}</div>
                        {c.REVENUE && <div className="text-green-400 mt-1">{parseFloat(c.REVENUE).toLocaleString()} ₽</div>}
                     </td>
                     <td className="py-3 px-2 text-white/50 text-xs">
                       {new Date(c.DATE_CREATE).toLocaleDateString("ru-RU")}
                     </td>
                  </tr>
                ))}

                {(activeTab === 'contacts' ? filteredContacts : filteredCompanies).length === 0 && (
                   <tr>
                    <td colSpan={4} className="py-10 text-center text-white/30">Ничего не найдено</td>
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
