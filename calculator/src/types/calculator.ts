// src/types/calculator.ts
// Типы TypeScript для калькулятора этикеток flex-n-roll.pro

// ─── Тип этикетки ───────────────────────────────────────────────────────────
export type LabelType =
  | 'self_adhesive'  // Самоклеящаяся
  | 'sleeve'         // Sleeve (термоусадочная гильза)
  | 'ar'             // AR (дополненная реальность)
  | 'thermochrome'   // Термохром (меняет цвет при температуре)
  | 'linerless';     // Linerless (без подложки)

// ─── Материал ───────────────────────────────────────────────────────────────
export type Material =
  | 'semi_gloss'  // Бумага Semi Gloss
  | 'pe'          // PE (полиэтилен)
  | 'pet'         // PET (полиэтилентерефталат)
  | 'bopp'        // BOPP (двухосноориентированный полипропилен)
  | 'pp_white'    // PP White (белый полипропилен)
  | 'pp_silver'   // PP Silver (серебристый полипропилен)
  | 'pp_clear'    // PP Clear (прозрачный полипропилен)
  | 'aluminum';   // Алюминий

// ─── Форма высечки ──────────────────────────────────────────────────────────
export type CutShape =
  | 'rectangle'  // Прямоугольник
  | 'circle'     // Круг
  | 'oval'       // Овал
  | 'contour';   // По контуру

// ─── Специальная отделка ────────────────────────────────────────────────────
export type Finishing =
  | 'foil_stamping'  // Тиснение фольгой
  | 'matte_lam'      // Ламинация матовая
  | 'gloss_lam'      // Ламинация глянцевая
  | 'uv_varnish'     // УФ-лак полный
  | 'spot_varnish'   // Выборочный лак
  | 'none';          // Без отделки

// ─── Тираж ──────────────────────────────────────────────────────────────────
export type Circulation =
  | 1000
  | 2000
  | 5000
  | 10000
  | 25000
  | 50000
  | 100000
  | 500000
  | 1000000;

// ─── Состояние формы калькулятора ───────────────────────────────────────────
export interface CalculatorFormState {
  // Шаг 1
  labelType: LabelType | null;
  material: Material | null;

  // Шаг 2
  width: number;         // мм
  height: number;        // мм
  cutShape: CutShape | null;
  colors: number;        // 1–12

  // Шаг 3
  finishing: Finishing[];       // мультиселект
  circulation: Circulation | null;
  hasDesign: boolean | null;    // true = готовый макет, false = нужна разработка
}

// ─── Результат расчёта ──────────────────────────────────────────────────────
export interface PriceCalculationResult {
  baseCost: number;         // Базовая стоимость (до скидок)
  colorSurcharge: number;   // Надбавка за цвета сверх 4
  finishingCost: number;    // Стоимость финишинга
  setupCost: number;        // Стоимость подготовки ($200)
  designCost: number;       // Стоимость разработки макета ($150 если нет)
  subtotal: number;         // Итого до скидки
  discountRate: number;     // Процент скидки (0–20)
  discountAmount: number;   // Сумма скидки
  totalCost: number;        // Итоговая стоимость
  pricePerThousand: number; // Цена за 1000 шт.
  productionDays: string;   // Срок производства
}

// ─── Данные лида для Битрикс24 ──────────────────────────────────────────────
export interface LeadFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
}

// ─── Полный payload для отправки лида ───────────────────────────────────────
export interface BitrixLeadPayload {
  formData: LeadFormData;
  calculatorData: CalculatorFormState;
  result: PriceCalculationResult;
}

// ─── Ответ от API бэкенда ───────────────────────────────────────────────────
export interface BitrixApiResponse {
  success: boolean;
  leadId?: number;
  error?: string;
}

// ─── Текущий шаг визарда ────────────────────────────────────────────────────
export type WizardStep = 1 | 2 | 3 | 'result';