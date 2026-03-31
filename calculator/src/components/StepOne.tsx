// src/components/StepOne.tsx
// Шаг 1: Выбор типа этикетки и материала

import React from 'react';
import type { LabelType, Material } from '../types/calculator';
import {
  LABEL_TYPE_OPTIONS,
  MATERIAL_OPTIONS,
  LABEL_TYPE_LABELS,
  MATERIAL_LABELS,
  LABEL_TYPE_ICONS,
  LABEL_TYPE_DESCRIPTIONS,
  MATERIAL_BASE_COST,
} from '../data/pricing';

interface StepOneProps {
  selectedType: LabelType | null;
  selectedMaterial: Material | null;
  onTypeChange: (type: LabelType) => void;
  onMaterialChange: (material: Material) => void;
}

const MATERIAL_COLORS: Partial<Record<Material, string>> = {
  semi_gloss: 'bg-yellow-50 border-yellow-200',
  pe: 'bg-blue-50 border-blue-200',
  pet: 'bg-cyan-50 border-cyan-200',
  bopp: 'bg-green-50 border-green-200',
  pp_white: 'bg-gray-50 border-gray-200',
  pp_silver: 'bg-slate-50 border-slate-300',
  pp_clear: 'bg-sky-50 border-sky-200',
  aluminum: 'bg-zinc-50 border-zinc-300',
};

export const StepOne: React.FC<StepOneProps> = ({
  selectedType,
  selectedMaterial,
  onTypeChange,
  onMaterialChange,
}) => {
  return (
    <div className="space-y-8">
      {/* ── Тип этикетки ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Тип этикетки</h3>
        <p className="text-sm text-gray-500 mb-4">
          Выберите технологию производства, подходящую для вашего продукта
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LABEL_TYPE_OPTIONS.map((type) => {
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => onTypeChange(type)}
                className={[
                  'relative text-left p-4 rounded-xl border-2 transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
                  'hover:shadow-md hover:-translate-y-0.5',
                  isSelected
                    ? 'border-brand-blue bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-blue-300',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 w-5 h-5 bg-brand-blue rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
                <div className="text-2xl mb-2">{LABEL_TYPE_ICONS[type]}</div>
                <div className={['font-semibold text-sm mb-1', isSelected ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                  {LABEL_TYPE_LABELS[type]}
                </div>
                <div className="text-xs text-gray-500 leading-snug">
                  {LABEL_TYPE_DESCRIPTIONS[type]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Материал ──────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Материал</h3>
        <p className="text-sm text-gray-500 mb-4">
          Базовая цена материала влияет на итоговую стоимость
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MATERIAL_OPTIONS.map((material) => {
            const isSelected = selectedMaterial === material;
            const colorClasses = MATERIAL_COLORS[material] || 'bg-white border-gray-200';

            return (
              <button
                key={material}
                onClick={() => onMaterialChange(material)}
                className={[
                  'relative text-left p-3 rounded-xl border-2 transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
                  'hover:shadow-md hover:-translate-y-0.5',
                  isSelected
                    ? 'border-brand-blue bg-blue-50 shadow-md'
                    : `${colorClasses} hover:border-blue-300`,
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-brand-blue rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
                <div className={['font-semibold text-sm mb-1', isSelected ? 'text-brand-blue' : 'text-gray-800'].join(' ')}>
                  {MATERIAL_LABELS[material]}
                </div>
                <div className="text-xs text-gray-400">${MATERIAL_BASE_COST[material]}/кг</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};