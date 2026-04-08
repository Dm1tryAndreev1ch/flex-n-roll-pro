import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { RefreshCw, CheckCircle, AlertCircle, Clock, Zap, Database } from "lucide-react";

const MODELS = [
  {
    name: "DealPredictor",
    description: "RandomForest · Прогноз вероятности закрытия сделки",
    lastTrained: "01.06.2025 03:14",
    metrics: { accuracy: 0.91, f1: 0.88, auc: 0.94, precision: 0.89, recall: 0.87 },
    trainDays: 365,
    samples: 4821,
    status: "ok",
    color: "blue",
  },
  {
    name: "ChurnDetector",
    description: "GradientBoosting · Предсказание оттока клиентов",
    lastTrained: "01.06.2025 03:28",
    metrics: { accuracy: 0.87, f1: 0.84, auc: 0.91, precision: 0.85, recall: 0.83 },
    trainDays: 730,
    samples: 3244,
    status: "ok",
    color: "red",
  },
  {
    name: "CrossSellEngine",
    description: "Apriori + XGBoost · Рекомендации товаров/услуг",
    lastTrained: "01.06.2025 03:41",
    metrics: { accuracy: 0.83, f1: 0.80, auc: 0.87, precision: 0.81, recall: 0.79 },
    trainDays: 730,
    samples: 6102,
    status: "ok",
    color: "violet",
  },
  {
    name: "ContactOptimizer",
    description: "KMeans + LogReg · Оптимальное время и канал контакта",
    lastTrained: "01.06.2025 03:52",
    metrics: { accuracy: 0.79, f1: 0.76, auc: 0.83, precision: 0.77, recall: 0.75 },
    trainDays: 365,
    samples: 2891,
    status: "warning",
    color: "cyan",
  },
];

const historyData = [
  { date: "Янв", DealPredictor: 82, ChurnDetector: 79, CrossSell: 75, ContactOpt: 70 },
  { date: "Фев", DealPredictor: 84, ChurnDetector: 81, CrossSell: 77, ContactOpt: 72 },
  { date: "Мар", DealPredictor: 80, ChurnDetector: 78, CrossSell: 74, ContactOpt: 68 },
  { date: "Апр", DealPredictor: 87, ChurnDetector: 83, CrossSell: 79, ContactOpt: 74 },
  { date: "Май", DealPredictor: 89, ChurnDetector: 85, CrossSell: 81, ContactOpt: 76 },
  { date: "Июн", DealPredictor: 91, ChurnDetector: 87, CrossSell: 83, ContactOpt: 79 },
];

const COLOR_MAP: Record<string, string> = {
  blue: "border-blue-500/30 bg-blue-500/5",
  red: "border-red-500/30 bg-red-500/5",
  violet: "border-violet-500/30 bg-violet-500/5",
  cyan: "border-cyan-500/30 bg-cyan-500/5",
};

const TEXT_MAP: Record<string, string> = {
  blue: "text-blue-400",
  red: "text-red-400",
  violet: "text-violet-400",
  cyan: "text-cyan-400",
};

const BAR_MAP: Record<string, string> = {
  blue: "bg-blue-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2235] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm space-y-1">
      <p className="text-white/60 text-xs mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/60 text-xs">{p.name}:</span>
          <span className="text-white font-bold text-xs">{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

export default function RetrainPage() {
  const [retraining, setRetraining] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);

  const handleRetrain = async (name: string) => {
    setRetraining(name);
    await new Promise(r => setTimeout(r, 2200));
    setRetraining(null);
    setDone(prev => [...prev, name]);
    await new Promise(r => setTimeout(r, 3000));
    setDone(prev => prev.filter(n => n !== name));
  };

  const handleRetrainAll = async () => {
    for (const m of MODELS) {
      await handleRetrain(m.name);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <RefreshCw size={16} className="text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Переобучение моделей</h1>
          </div>
          <p className="text-white/40 text-sm">Ежемесячный запуск · 1-е число 03:00 · Последнее: 01.06.2025</p>
        </div>
        <button
          onClick={handleRetrainAll}
          disabled={!!retraining}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-300 hover:bg-amber-500/30 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={15} className={retraining ? "animate-spin" : ""} />
          Переобучить все
        </button>
      </div>

      {/* Next run info */}
      <div className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-3">
        <Clock size={16} className="text-white/30" />
        <div className="text-sm">
          <span className="text-white/40">Следующий запуск:</span>
          <span className="text-white/70 font-medium ml-2">01.07.2025 в 03:00</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-white/30">
          <Database size={12} />
          <span>Данные: Bitrix24 CRM (live)</span>
        </div>
      </div>

      {/* Models */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {MODELS.map((model) => {
          const isRunning = retraining === model.name;
          const isDone = done.includes(model.name);
          return (
            <div key={model.name} className={`border rounded-2xl p-5 transition-all ${COLOR_MAP[model.color]}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-white text-base`}>{model.name}</h3>
                    {model.status === "warning" && !isDone && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <AlertCircle size={10} /> Низкая точность
                      </span>
                    )}
                    {isDone && (
                      <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <CheckCircle size={10} /> Обновлено
                      </span>
                    )}
                  </div>
                  <p className="text-white/35 text-xs mt-1">{model.description}</p>
                </div>
                <button
                  onClick={() => handleRetrain(model.name)}
                  disabled={!!retraining}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed border ${TEXT_MAP[model.color]} border-current bg-current/10 hover:bg-current/20`}
                >
                  <RefreshCw size={12} className={isRunning ? "animate-spin" : ""} />
                  {isRunning ? "Обучение..." : "Запустить"}
                </button>
              </div>

              {/* Progress bar while training */}
              {isRunning && (
                <div className="mb-4">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${BAR_MAP[model.color]} rounded-full animate-pulse`} style={{ width: "65%" }} />
                  </div>
                  <p className="text-white/30 text-xs mt-1.5 flex items-center gap-1.5">
                    <Zap size={11} className="text-amber-400" />
                    Обработка {model.samples.toLocaleString()} записей за {model.trainDays} дней...
                  </p>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {Object.entries(model.metrics).map(([key, val]) => (
                  <div key={key} className="text-center">
                    <p className={`text-sm font-bold ${TEXT_MAP[model.color]}`}>{(val * 100).toFixed(0)}%</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wide">{key}</p>
                  </div>
                ))}
              </div>

              {/* Metric bars */}
              <div className="space-y-1.5">
                {Object.entries(model.metrics).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-white/30 text-xs w-16">{key}</span>
                    <div className="flex-1 h-1 bg-white/8 rounded-full">
                      <div
                        className={`h-full rounded-full ${BAR_MAP[model.color]} transition-all`}
                        style={{ width: `${val * 100}%` }}
                      />
                    </div>
                    <span className="text-white/40 text-xs w-8 text-right">{(val * 100).toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-xs text-white/25">
                <span>Обучено: {model.lastTrained}</span>
                <span>{model.samples.toLocaleString()} samples · {model.trainDays} days</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* History chart */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-1">История точности (Accuracy %)</h3>
        <p className="text-white/30 text-xs mb-5">Ежемесячная динамика по всем моделям</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={historyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[65, 95]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="DealPredictor" name="DealPredictor" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
            <Line type="monotone" dataKey="ChurnDetector" name="ChurnDetector" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
            <Line type="monotone" dataKey="CrossSell"     name="CrossSell"     stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 3 }} />
            <Line type="monotone" dataKey="ContactOpt"   name="ContactOpt"    stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
