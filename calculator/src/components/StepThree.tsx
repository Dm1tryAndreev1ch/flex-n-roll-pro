// src/components/StepThree.tsx
// Шаг 3: Специальная отделка, тираж, наличие макета

import React from 'react';
import type { Finishing, Circulation } from '../types/calculator';
import {
  FINISHING_OPTIONS,
  FINISHING_LABELS,
  FINISHING_COST,
  CIRCULATION_OPTIONS,
  CIRCULATION_LABELS,
  CIRCULATION_DISCOUNTS,
} from '../data/pricing';

interface StepThreeProps {
  finishing: Finishing[];
  circulation: Circulation | null;
  hasDesign: boolean | null;
  onFinishingToggle: (finishing: Finishing) => void;
  onCirculationChange: (circulation: Circulation) => void;
  onHasDesignChange: (hasDesign: boolean) => void;
}

const FINISHING_ICONS: Record<Finishing, string> = {
  foil_stamping: '✨',
  matte_lam: '🔲',
  gloss_lam: '💎',
  uv_varnish: '🔆',
  spot_varnish: '🎯',
  none: '⚪',
};

function getDiscountForCirculation(qty: number): number {
  const applicable = CIRCULATION_DISCOUNTS.find((d) => qty >= d.minQty);
  return applicable ? applicable.discount * 100 : 0;
}

export const StepThree: React.FC<StepThreeProps> = ({
  finishing, circulation, hasDesign,
  onFinishingToggle, onCirculationChange, onHasDesignChange,
}) => {
  return (
    <div className="space-y-8">
      {/* ── Специальная отделка ───────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Специальная отделка</h3>
        <p className="text-sm text-gray-500 mb-4">Можно выбрать несколько видов отделки</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FINISHING_OPTIONS.map((f) => {
            const isSelected = finishing.includes(f);
            const costPerUnit = FINISHING_COST[f];
            return (
              <button
                key={f}
                onClick={() => onFinishingToggle(f)}
                className={[
                  'flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:shadow-md hover:-translate-y-0.5',
                  isSelected ? 'border-brand-blue bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                <div className={[
                  'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                  isSelected ? 'bg-brand-blue border-brand-blue' : 'border-gray-300',
                ].join(' ')}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="text-xl">{FINISHING_ICONS[f]}</div>
                <div className="flex-1 min-w-0">
                  <div className={['font-semibold text-sm', isSelected ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                    {FINISHING_LABELS[f]}
                  </div>
                  {costPerUnit > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5">+${costPerUnit}/шт.</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Тираж ─────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Тираж</h3>
        <p className="text-sm text-gray-500 mb-4">При больших тиражах действуют скидки до 20%</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {CIRCULATION_OPTIONS.map((qty) => {
            const isSelected = circulation === qty;
            const discount = getDiscountForCirculation(qty);
            return (
              <button
                key={qty}
                onClick={() => onCirculationChange(qty)}
                className={[
                  'relative p-3 rounded-xl border-2 text-center transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:shadow-md hover:-translate-y-0.5',
                  isSelected ? 'border-brand-blue bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {discount > 0 && (
                  <span className={[
                    'absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    isSelected ? 'bg-brand-orange text-white' : 'bg-green-500 text-white',
                  ].join(' ')}>
                    -{discount}%
                  </span>
                )}
                <div className={['font-bold text-sm', isSelected ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                  {CIRCULATION_LABELS[qty]}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 font-medium mb-2">Скидки по тиражу:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CIRCULATION_DISCOUNTS.map((d) => (
              <span key={d.minQty} className="text-xs text-gray-600">
                {d.minQty.toLocaleString('ru-RU')}+ шт. → <strong className="text-green-600">-{d.discount * 100}%</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Наличие макета ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Наличие макета</h3>
        <p className="text-sm text-gray-500 mb-4">
          Если у вас нет готового макета — мы разработаем дизайн за $150
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onHasDesignChange(true)}
            className={[
              'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:shadow-md hover:-translate-y-0.5',
              hasDesign === true ? 'border-brand-blue bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300',
            ].join(' ')}
            aria-pressed={hasDesign === true}
          >
            <div className="text-3xl flex-shrink-0">✅</div>
            <div>
              <div className={['font-semibold text-sm', hasDesign === true ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                Есть готовый макет
              </div>
              <div className="text-xs text-gray-500 mt-1">AI, PDF, TIFF или CDR</div>
              <div className="text-xs text-green-600 font-medium mt-1">Без доплаты</div>
            </div>
          </button>

          <button
            onClick={() => onHasDesignChange(false)}
            className={[
              'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:shadow-md hover:-translate-y-0.5',
              hasDesign === false ? 'border-brand-blue bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300',
            ].join(' ')}
            aria-pressed={hasDesign === false}
          >
            <div className="text-3xl flex-shrink-0">🎨</div>
            <div>
              <div className={['font-semibold text-sm', hasDesign === false ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                Нужна разработка дизайна
              </div>
              <div className="text-xs text-gray-500 mt-1">Наши дизайнеры создадут уникальный дизайн</div>
              <div className="text-xs text-amber-600 font-medium mt-1">+$150 к стоимости заказа</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};