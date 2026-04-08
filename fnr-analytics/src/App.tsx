import { useState, useEffect } from "react";
import LoginPage from "./components/LoginPage";
import Sidebar, { type Page } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import PredictPage from "./components/PredictPage";
import ChurnPage from "./components/ChurnPage";
import OptimizerPage from "./components/OptimizerPage";
import CrossSellPage from "./components/CrossSellPage";
import RetrainPage from "./components/RetrainPage";
import SettingsPage from "./components/SettingsPage";
import { Bell, Search } from "lucide-react";

type AuthState = "login" | "app";

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "Дашборд",
  predict:   "Прогноз сделок",
  churn:     "Churn Detection",
  optimizer: "Время контакта",
  crosssell: "Cross-Sell",
  retrain:   "Переобучение",
  settings:  "Настройки",
};

export default function App() {
  const [auth, setAuth] = useState<AuthState>("login");
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications] = useState(3);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (auth === "login") {
    return <LoginPage onLogin={() => setAuth("app")} />;
  }

  const renderPage = () => {
    switch (page) {
      case "dashboard":  return <Dashboard />;
      case "predict":    return <PredictPage />;
      case "churn":      return <ChurnPage />;
      case "optimizer":  return <OptimizerPage />;
      case "crosssell":  return <CrossSellPage />;
      case "retrain":    return <RetrainPage />;
      case "settings":   return <SettingsPage />;
      default:           return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-[#080d1a] overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Sidebar */}
      <Sidebar
        current={page}
        onChange={setPage}
        onLogout={() => setAuth("login")}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-white/80 font-semibold text-base">{PAGE_TITLES[page]}</h2>
            <div className="flex items-center gap-1.5 text-white/20 text-xs">
              <span>/</span>
              <span>FLEX-N-ROLL Analytics</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white/30 text-sm w-48 hover:border-white/15 transition-colors cursor-pointer">
              <Search size={14} />
              <span className="text-xs">Поиск...</span>
              <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</span>
            </div>

            {/* Clock */}
            <div className="text-white/30 text-sm font-mono hidden md:block">
              {time.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/8 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/10 transition-all">
                <Bell size={16} />
              </button>
              {notifications > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">{notifications}</span>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-violet-500/20 cursor-pointer">
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {/* Subtle bg gradient */}
          <div className="min-h-full relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              {renderPage()}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-2 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4 text-white/15 text-xs">
            <span>FLEX-N-ROLL Analytics v2.1.0</span>
            <span>·</span>
            <span>Bitrix24 CRM</span>
            <span>·</span>
            <span>4 активных модели</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/20 text-xs">Планировщик работает</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
