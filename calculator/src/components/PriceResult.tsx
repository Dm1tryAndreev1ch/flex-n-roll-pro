// src/components/PriceResult.tsx
// Компонент отображения результата расчёта стоимости этикеток

import React, { useState } from 'react';
import type { PriceCalculationResult, CalculatorFormState } from '../types/calculator';
import {
  LABEL_TYPE_LABELS, MATERIAL_LABELS, CUT_SHAPE_LABELS,
  FINISHING_LABELS, CIRCULATION_LABELS,
} from '../data/pricing';
import { formatCurrency, formatNumber } from '../utils/priceCalc';
import { LeadForm } from './LeadForm';

interface PriceResultProps {
  result: PriceCalculationResult;
  formState: CalculatorFormState;
  onRecalculate: () => void;
}

export const PriceResult: React.FC<PriceResultProps> = ({ result, formState, onRecalculate }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Главная карточка результата ───────────────────────────────── */}
      <div className="bg-gradient-to-br from-brand-blue to-blue-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-brand-orange" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-blue-200 text-sm font-medium">Расчёт готов</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-blue-200 text-xs mb-1">Цена за 1 000 шт.</p>
            <p className="text-3xl font-extrabold tracking-tight">{formatCurrency(result.pricePerThousand)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs mb-1">Общая стоимость</p>
            <p className="text-2xl font-bold">{formatCurrency(result.totalCost)}</p>
            {result.discountRate > 0 && (
              <p className="text-green-300 text-xs mt-0.5">
                Скидка {result.discountRate}% (-{formatCurrency(result.discountAmount)})
              </p>
            )}
          </div>
          <div>
            <p className="text-blue-200 text-xs mb-1">Срок производства</p>
            <p className="text-lg font-semibold">{result.productionDays}</p>
            <p className="text-blue-300 text-xs mt-0.5">
              Тираж: {formState.circulation ? formatNumber(formState.circulation) : '—'} шт.
            </p>
          </div>
        </div>
      </div>

      {/* ── Параметры заказа ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Параметры заказа</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
          <SpecRow label="Тип этикетки">{formState.labelType ? LABEL_TYPE_LABELS[formState.labelType] : '—'}</SpecRow>
          <SpecRow label="Материал">{formState.material ? MATERIAL_LABELS[formState.material] : '—'}</SpecRow>
          <SpecRow label="Размер">{formState.width} × {formState.height} мм</SpecRow>
          <SpecRow label="Форма высечки">{formState.cutShape ? CUT_SHAPE_LABELS[formState.cutShape] : '—'}</SpecRow>
          <SpecRow label="Цветов печати">{formState.colors}</SpecRow>
          <SpecRow label="Отделка">
            {formState.finishing.length > 0
              ? formState.finishing.map((f) => FINISHING_LABELS[f]).join(', ')
              : 'Без отделки'}
          </SpecRow>
          <SpecRow label="Макет">{formState.hasDesign ? 'Готовый' : 'Разработка (+$150)'}</SpecRow>
          <SpecRow label="Тираж">{formState.circulation ? CIRCULATION_LABELS[formState.circulation] : '—'}</SpecRow>
        </div>
      </div>

      {/* ── Детализация стоимости (раскрываемая) ─────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-800">Детализация стоимости</span>
          <svg className={['w-5 h-5 text-gray-500 transition-transform duration-200', showBreakdown ? 'rotate-180' : ''].join(' ')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showBreakdown && (
          <div className="border-t border-gray-100 p-5 space-y-2.5 text-sm">
            <PriceRow label="Базовая стоимость материала" value={result.baseCost} />
            {result.colorSurcharge > 0 && <PriceRow label="Надбавка за цвета (>4 цв.)" value={result.colorSurcharge} />}
            {result.finishingCost > 0 && <PriceRow label="Специальная отделка" value={result.finishingCost} />}
            <PriceRow label="Подготовка (препресс, формы)" value={result.setupCost} />
            {result.designCost > 0 && <PriceRow label="Разработка макета" value={result.designCost} />}
            <div className="border-t border-gray-200 pt-2.5 mt-2.5">
              <PriceRow label="Подытог" value={result.subtotal} isBold />
            </div>
            {result.discountRate > 0 && (
              <PriceRow label={`Скидка за тираж (-${result.discountRate}%)`} value={-result.discountAmount} isDiscount />
            )}
            <div className="border-t border-gray-200 pt-2.5 mt-2.5">
              <PriceRow label="Итого к оплате" value={result.totalCost} isTotal />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <PriceRow
                label={`Цена за 1 000 шт. (тираж ${formState.circulation ? formatNumber(formState.circulation) : '—'})`}
                value={result.pricePerThousand}
                isBold
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Кнопки действий ──────────────────────────────────────────── */}
      {!showLeadForm && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowLeadForm(true)}
            className="flex-1 py-3.5 px-6 bg-brand-orange hover:bg-orange-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Оформить заявку
          </button>
          <button
            onClick={onRecalculate}
            className="flex-1 sm:flex-none py-3.5 px-6 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-300 transition-all duration-200 hover:shadow-md"
          >
            Пересчитать
          </button>
        </div>
      )}

      {showLeadForm && (
        <LeadForm formState={formState} result={result} onCancel={() => setShowLeadForm(false)} />
      )}

      <p className="text-xs text-gray-400 text-center">
        * Расчёт приблизительный. Точная стоимость уточняется после проверки макета и согласования технических параметров. Цены указаны в USD.
      </p>
    </div>
  );
};

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium mt-0.5">{children}</span>
    </div>
  );
}

function PriceRow({
  label, value, isBold = false, isTotal = false, isDiscount = false,
}: { label: string; value: number; isBold?: boolean; isTotal?: boolean; isDiscount?: boolean }) {
  const absValue = Math.abs(value);
  const isNegative = value < 0;
  return (
    <div className={['flex justify-between items-baseline', isTotal ? 'font-bold text-base' : '', isBold ? 'font-semibold' : ''].join(' ')}>
      <span className={isTotal ? 'text-gray-900' : 'text-gray-600'}>{label}</span>
      <span className={[isTotal ? 'text-brand-blue text-lg' : isDiscount || isNegative ? 'text-green-600' : 'text-gray-800'].join(' ')}>
        {isNegative ? '−' : ''}{formatCurrency(absValue)}
      </span>
    </div>
  );
}