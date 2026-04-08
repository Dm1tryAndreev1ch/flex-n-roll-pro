import {
  LayoutDashboard,
  TrendingUp,
  UserX,
  Clock,
  ShoppingBag,
  RefreshCw,
  Settings,
  LogOut,
  ChevronRight,
  Activity,
} from "lucide-react";

export type Page =
  | "dashboard"
  | "predict"
  | "churn"
  | "optimizer"
  | "crosssell"
  | "retrain"
  | "settings";

interface SidebarProps {
  current: Page;
  onChange: (p: Page) => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: "dashboard",  label: "Дашборд",         icon: <LayoutDashboard size={18} /> },
  { id: "predict",    label: "Прогноз сделок",   icon: <TrendingUp size={18} />,   badge: "07:00" },
  { id: "churn",      label: "Churn Detection",  icon: <UserX size={18} />,         badge: "08:00" },
  { id: "optimizer",  label: "Время контакта",   icon: <Clock size={18} />,         badge: "09:00" },
  { id: "crosssell",  label: "Cross-Sell",       icon: <ShoppingBag size={18} />,   badge: "Пн" },
  { id: "retrain",    label: "Переобучение",     icon: <RefreshCw size={18} />,     badge: "1-е" },
  { id: "settings",   label: "Настройки",        icon: <Settings size={18} /> },
];

export default function Sidebar({ current, onChange, onLogout, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`flex flex-col h-full bg-[#0d1424] border-r border-white/5 transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
          <Activity size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight">FLEX-N-ROLL</p>
            <p className="text-blue-400/60 text-[10px] uppercase tracking-widest">Analytics</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`ml-auto text-white/20 hover:text-white/60 transition-colors ${collapsed ? "mx-auto" : ""}`}
        >
          <ChevronRight size={16} className={`transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                ${active
                  ? "bg-blue-500/15 text-blue-300 shadow-sm"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
            >
              {/* Active indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full" />
              )}
              <span className={`shrink-0 transition-colors ${active ? "text-blue-400" : "text-white/40 group-hover:text-white/60"}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${active ? "bg-blue-500/20 text-blue-300" : "bg-white/5 text-white/30"}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/5 p-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              A
            </div>
            <div className="overflow-hidden">
              <p className="text-white/80 text-xs font-medium truncate">admin</p>
              <p className="text-white/30 text-[10px] truncate">Администратор</p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? "Выйти" : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 text-sm ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut size={16} />
          {!collapsed && "Выйти"}
        </button>
      </div>
    </aside>
  );
}
