import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Target, Activity, Loader2 } from "lucide-react";
import { useBitrixDeals, useBitrixContacts, useBitrixActivities } from "../hooks/useBitrix";
import { getStageInfo } from "../utils/constants";


const StatCard = ({ title, value, icon, gradient, color, loading }: any) => (
  <div className={`bg-gradient-to-br ${gradient} border border-${color}-500/20 rounded-2xl p-5 relative overflow-hidden`}>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl bg-${color}-500/20 flex items-center justify-center text-${color}-400`}>
        {icon}
      </div>
    </div>
    {loading ? (
      <div className="h-9 w-16 bg-white/10 animate-pulse rounded-lg mb-1" />
    ) : (
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
    )}
    <p className="text-white/50 text-sm">{title}</p>
  </div>
);

export default function Dashboard() {
  const { deals, loading: dealsLoading } = useBitrixDeals();
  const { contacts, loading: contactsLoading } = useBitrixContacts();
  const { activities, loading: activitiesLoading } = useBitrixActivities();

  // Calculate metrics
  const activeDeals = deals.filter(d => d.CLOSED === 'N');
  const wonDeals = deals.filter(d => Boolean(d.STAGE_ID) && getStageInfo(d.STAGE_ID).color === 'green');
  
  // Chart data: Distribution of active deals by stage
  const stageCounts: Record<string, number> = {};
  activeDeals.forEach(d => {
    const label = getStageInfo(d.STAGE_ID).label;
    stageCounts[label] = (stageCounts[label] || 0) + 1;
  });

  const chartData = Object.entries(stageCounts).map(([name, count]) => ({ name, count }));

  // Recent deals for list
  const recentDeals = [...deals].sort((a,b) => new Date(b.DATE_CREATE).getTime() - new Date(a.DATE_CREATE).getTime()).slice(0, 5);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Дашборд</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-300 text-sm font-medium">Синхронизировано с Bitrix24</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard 
          title="Открытые сделки" value={activeDeals.length} icon={<TrendingUp size={20} />} 
          gradient="from-blue-500/20 to-blue-600/5" color="blue" loading={dealsLoading} 
        />
        <StatCard 
          title="Сделки (успешные)" value={wonDeals.length} icon={<Target size={20} />} 
          gradient="from-green-500/20 to-green-600/5" color="green" loading={dealsLoading} 
        />
        <StatCard 
          title="Контакты в базе" value={contacts.length} icon={<Users size={20} />} 
          gradient="from-violet-500/20 to-violet-600/5" color="violet" loading={contactsLoading} 
        />
        <StatCard 
          title="Активности менеджеров" value={activities.length} icon={<Activity size={20} />} 
          gradient="from-cyan-500/20 to-cyan-600/5" color="cyan" loading={activitiesLoading} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deal distribution */}
        <div className="lg:col-span-2 bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">Воронка продаж <span className="text-xs font-normal text-white/30">(только активные)</span></h3>
            </div>
          </div>
          {dealsLoading ? (
             <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradBlue2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white" }} />
                <Area type="monotone" dataKey="count" name="Сделок" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBlue2)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Deals */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold">Новые сделки</h3>
          </div>
          <div className="space-y-2">
            {dealsLoading ? (
               <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
            ) : (
              recentDeals.map((deal) => (
                <div key={deal.ID} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate">{deal.TITLE || `Сделка #${deal.ID}`}</p>
                    <p className="text-white/30 text-xs">{new Date(deal.DATE_CREATE).toLocaleDateString()}</p>
                  </div>
                  <span className="text-white/60 text-xs font-medium shrink-0">
                    {parseFloat(deal.OPPORTUNITY || 0).toLocaleString()} {deal.CURRENCY_ID}
                  </span>
                </div>
              ))
            )}
            {(!dealsLoading && recentDeals.length === 0) && (
              <p className="text-center text-white/30 text-sm">Сделок нет</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
