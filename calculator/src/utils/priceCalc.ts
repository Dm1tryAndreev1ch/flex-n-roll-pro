// src/utils/priceCalc.ts
// Функции расчёта стоимости этикеток для flex-n-roll.pro

import type { CalculatorFormState, PriceCalculationResult } from '../types/calculator';
import {
  MATERIAL_BASE_COST,
  FINISHING_COST,
  COLOR_SURCHARGE_RATE,
  SETUP_COST,
  DESIGN_COST,
  CIRCULATION_DISCOUNTS,
  getProductionDays,
} from '../data/pricing';

/**
 * Основная функция расчёта стоимости заказа.
 * Принимает состояние формы, возвращает детальный результат.
 */
export function calculatePrice(state: CalculatorFormState): PriceCalculationResult | null {
  // Проверяем, что все необходимые поля заполнены
  if (
    !state.labelType ||
    !state.material ||
    !state.cutShape ||
    !state.circulation ||
    state.hasDesign === null ||
    state.width < 20 ||
    state.height < 20
  ) {
    return null;
  }

  const { material, width, height, colors, finishing, circulation, hasDesign } = state;

  // ── 1. Базовая стоимость материала ────────────────────────────────────────
  // Формула: базовая_цена_материала * (ширина_мм * высота_мм / 1_000_000) * тираж
  // Делим на 1 000 000, чтобы перевести мм² → м²
  const materialCostPerUnit = MATERIAL_BASE_COST[material] * (width * height) / 1_000_000;
  const baseCost = materialCostPerUnit * circulation;

  // ── 2. Надбавка за цвета (сверх 4 базовых) ───────────────────────────────
  // За каждый цвет свыше 4 добавляем 10% от базовой стоимости
  const extraColors = Math.max(0, colors - 4);
  const colorSurcharge = baseCost * COLOR_SURCHARGE_RATE * extraColors;

  // ── 3. Стоимость финишинга ────────────────────────────────────────────────
  // Суммируем стоимость каждого вида отделки ($/шт. × тираж)
  // Исключаем 'none' — нулевая стоимость
  const activeFinishing = finishing.filter((f) => f !== 'none');
  const finishingCostPerUnit = activeFinishing.reduce(
    (sum, f) => sum + FINISHING_COST[f],
    0
  );
  const finishingCost = finishingCostPerUnit * circulation;

  // ── 4. Стоимость подготовки (фиксированная) ───────────────────────────────
  const setupCost = SETUP_COST; // $200

  // ── 5. Стоимость разработки макета (если нет готового) ───────────────────
  const designCost = hasDesign ? 0 : DESIGN_COST; // $150

  // ── 6. Подытог до скидки ─────────────────────────────────────────────────
  const subtotal = baseCost + colorSurcharge + finishingCost + setupCost + designCost;

  // ── 7. Скидка по тиражу ──────────────────────────────────────────────────
  // Ищем максимальную применимую скидку (массив отсортирован по убыванию minQty)
  const applicableDiscount = CIRCULATION_DISCOUNTS.find(
    (d) => circulation >= d.minQty
  );
  const discountRate = applicableDiscount ? applicableDiscount.discount : 0;
  const discountAmount = subtotal * discountRate;

  // ── 8. Итоговая стоимость ─────────────────────────────────────────────────
  const totalCost = subtotal - discountAmount;

  // ── 9. Цена за 1000 шт. ──────────────────────────────────────────────────
  const pricePerThousand = totalCost / (circulation / 1000);

  // ── 10. Срок производства ─────────────────────────────────────────────────
  const productionDays = getProductionDays(circulation);

  return {
    baseCost: roundTo2(baseCost),
    colorSurcharge: roundTo2(colorSurcharge),
    finishingCost: roundTo2(finishingCost),
    setupCost: roundTo2(setupCost),
    designCost: roundTo2(designCost),
    subtotal: roundTo2(subtotal),
    discountRate: discountRate * 100, // Переводим в проценты для отображения
    discountAmount: roundTo2(discountAmount),
    totalCost: roundTo2(totalCost),
    pricePerThousand: roundTo2(pricePerThousand),
    productionDays,
  };
}

/** Округление до 2 знаков после запятой */
function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Форматирование числа как денежной суммы (USD)
 * Пример: 1234.5 → "$1,234.50"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Форматирование числа с разделителями тысяч
 * Пример: 1000000 → "1 000 000"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

/**
 * Проверка валидности размеров этикетки
 */
export function validateDimensions(width: number, height: number): string | null {
  if (width < 20) return 'Минимальная ширина — 20 мм';
  if (width > 200) return 'Максимальная ширина — 200 мм';
  if (height < 20) return 'Минимальная высота — 20 мм';
  if (height > 300) return 'Максимальная высота — 300 мм';
  return null;
}

/**
 * Определяет, можно ли перейти к следующему шагу
 */
export function canProceedFromStep(step: number, state: CalculatorFormState): boolean {
  if (step === 1) {
    return state.labelType !== null && state.material !== null;
  }
  if (step === 2) {
    return (
      state.width >= 20 &&
      state.width <= 200 &&
      state.height >= 20 &&
      state.height <= 300 &&
      state.cutShape !== null &&
      state.colors >= 1 &&
      state.colors <= 12
    );
  }
  if (step === 3) {
    return state.circulation !== null && state.hasDesign !== null;
  }
  return false;
}