// src/data/pricing.ts
// Константы и справочники для калькулятора этикеток flex-n-roll.pro

import type {
  LabelType,
  Material,
  CutShape,
  Finishing,
  Circulation,
} from '../types/calculator';

// ─── Типы этикеток ─────────────────────────────────────────────────────────

export const LABEL_TYPE_OPTIONS: LabelType[] = [
  'self_adhesive',
  'sleeve',
  'ar',
  'thermochrome',
  'linerless',
];

export const LABEL_TYPE_LABELS: Record<LabelType, string> = {
  self_adhesive: 'Самоклеящаяся этикетка',
  sleeve: 'Термоусадочная sleeve',
  ar: 'AR-этикетка',
  thermochrome: 'Термохромная этикетка',
  linerless: 'Linerless (без подложки)',
};

export const LABEL_TYPE_ICONS: Record<LabelType, string> = {
  self_adhesive: '🏷️',
  sleeve: '🔄',
  ar: '📱',
  thermochrome: '🌡️',
  linerless: '📋',
};

export const LABEL_TYPE_DESCRIPTIONS: Record<LabelType, string> = {
  self_adhesive: 'Универсальная этикетка на клеевой основе для любых поверхностей',
  sleeve: 'Термоусадочная плёнка, облегающая тару по форме',
  ar: 'Этикетка с QR-кодом для дополненной реальности',
  thermochrome: 'Меняет цвет при изменении температуры продукта',
  linerless: 'Безподложечная этикетка — экономия до 40% на материале',
};

// ─── Материалы ─────────────────────────────────────────────────────────────

export const MATERIAL_OPTIONS: Material[] = [
  'semi_gloss',
  'pe',
  'pet',
  'bopp',
  'pp_white',
  'pp_silver',
  'pp_clear',
  'aluminum',
];

export const MATERIAL_LABELS: Record<Material, string> = {
  semi_gloss: 'Бумага Semi Gloss',
  pe: 'PE (полиэтилен)',
  pet: 'PET (полиэстер)',
  bopp: 'BOPP (полипропилен)',
  pp_white: 'PP White',
  pp_silver: 'PP Silver',
  pp_clear: 'PP Clear (прозрачный)',
  aluminum: 'Алюминий',
};

/** Базовая стоимость материала за м² в USD */
export const MATERIAL_BASE_COST: Record<Material, number> = {
  semi_gloss: 0.85,
  pe: 1.20,
  pet: 1.45,
  bopp: 1.30,
  pp_white: 1.35,
  pp_silver: 1.55,
  pp_clear: 1.40,
  aluminum: 2.10,
};

// ─── Форма высечки ─────────────────────────────────────────────────────────

export const CUT_SHAPE_OPTIONS: CutShape[] = [
  'rectangle',
  'circle',
  'oval',
  'contour',
];

export const CUT_SHAPE_LABELS: Record<CutShape, string> = {
  rectangle: 'Прямоугольник',
  circle: 'Круг',
  oval: 'Овал',
  contour: 'По контуру',
};

// ─── Специальная отделка ───────────────────────────────────────────────────

export const FINISHING_OPTIONS: Finishing[] = [
  'foil_stamping',
  'matte_lam',
  'gloss_lam',
  'uv_varnish',
  'spot_varnish',
  'none',
];

export const FINISHING_LABELS: Record<Finishing, string> = {
  foil_stamping: 'Тиснение фольгой',
  matte_lam: 'Ламинация матовая',
  gloss_lam: 'Ламинация глянцевая',
  uv_varnish: 'УФ-лак полный',
  spot_varnish: 'Выборочный лак',
  none: 'Без отделки',
};

/** Стоимость финишинга за единицу в USD */
export const FINISHING_COST: Record<Finishing, number> = {
  foil_stamping: 0.08,
  matte_lam: 0.04,
  gloss_lam: 0.045,
  uv_varnish: 0.035,
  spot_varnish: 0.05,
  none: 0,
};

// ─── Тираж ─────────────────────────────────────────────────────────────────

export const CIRCULATION_OPTIONS: Circulation[] = [
  1000,
  2000,
  5000,
  10000,
  25000,
  50000,
  100000,
  500000,
  1000000,
];

export const CIRCULATION_LABELS: Record<Circulation, string> = {
  1000: '1 000',
  2000: '2 000',
  5000: '5 000',
  10000: '10 000',
  25000: '25 000',
  50000: '50 000',
  100000: '100 000',
  500000: '500 000',
  1000000: '1 000 000',
};

/** Скидки по тиражу (отсортированы по убыванию minQty для find()) */
export const CIRCULATION_DISCOUNTS: { minQty: number; discount: number }[] = [
  { minQty: 1000000, discount: 0.20 },
  { minQty: 500000, discount: 0.15 },
  { minQty: 100000, discount: 0.12 },
  { minQty: 50000, discount: 0.10 },
  { minQty: 25000, discount: 0.07 },
  { minQty: 10000, discount: 0.05 },
  { minQty: 5000, discount: 0.03 },
];

// ─── Расчётные константы ───────────────────────────────────────────────────

/** Надбавка за каждый цвет сверх 4 базовых (10% от базовой стоимости) */
export const COLOR_SURCHARGE_RATE = 0.10;

/** Фиксированная стоимость подготовки (препресс, формы) в USD */
export const SETUP_COST = 200;

/** Стоимость разработки макета (если нет готового) в USD */
export const DESIGN_COST = 150;

/** Определяет срок производства на основе тиража */
export function getProductionDays(circulation: number): string {
  if (circulation <= 5000) return '3–5 рабочих дней';
  if (circulation <= 25000) return '5–7 рабочих дней';
  if (circulation <= 100000) return '7–10 рабочих дней';
  if (circulation <= 500000) return '10–14 рабочих дней';
  return '14–21 рабочий день';
}
