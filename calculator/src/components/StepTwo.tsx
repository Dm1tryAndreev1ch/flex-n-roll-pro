// src/components/StepTwo.tsx
// Шаг 2: Размеры этикетки, форма высечки, количество цветов

import React from 'react';
import type { CutShape } from '../types/calculator';
import { CUT_SHAPE_OPTIONS, CUT_SHAPE_LABELS } from '../data/pricing';
import { validateDimensions } from '../utils/priceCalc';

interface StepTwoProps {
  width: number;
  height: number;
  cutShape: CutShape | null;
  colors: number;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  onCutShapeChange: (shape: CutShape) => void;
  onColorsChange: (colors: number) => void;
}

// SVG-иконки для форм высечки
const CUT_SHAPE_ICONS: Record<CutShape, React.ReactNode> = {
  rectangle: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="10" width="28" height="20" rx="1" />
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="20" cy="20" r="14" />
    </svg>
  ),
  oval: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="20" cy="20" rx="16" ry="11" />
    </svg>
  ),
  contour: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 L32 14 L30 28 L10 28 L8 14 Z" />
    </svg>
  ),
};

export const StepTwo: React.FC<StepTwoProps> = ({
  width, height, cutShape, colors,
  onWidthChange, onHeightChange, onCutShapeChange, onColorsChange,
}) => {
  const dimensionError = validateDimensions(width, height);
  const areaCm2 = ((width * height) / 100).toFixed(1);

  return (
    <div className="space-y-8">
      {/* ── Размеры ────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Размеры этикетки</h3>
        <p className="text-sm text-gray-500 mb-4">
          Ширина × Высота в миллиметрах (от 20×20 до 200×300 мм)
        </p>

        <div className="flex items-start gap-4">
          {/* Ширина */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ширина, мм</label>
            <div className="relative">
              <input
                type="number" min={20} max={200} value={width}
                onChange={(e) => onWidthChange(Number(e.target.value))}
                className={[
                  'w-full px-3 py-2.5 rounded-lg border text-gray-800 font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors',
                  width < 20 || width > 200 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white',
                ].join(' ')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">мм</span>
            </div>
            <input type="range" min={20} max={200} value={width}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="w-full mt-2 h-1.5 bg-gray-200 rounded-full accent-brand-blue cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>20</span><span>200</span>
            </div>
          </div>

          <div className="flex items-center pt-9 text-2xl text-gray-400 font-light">×</div>

          {/* Высота */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Высота, мм</label>
            <div className="relative">
              <input
                type="number" min={20} max={300} value={height}
                onChange={(e) => onHeightChange(Number(e.target.value))}
                className={[
                  'w-full px-3 py-2.5 rounded-lg border text-gray-800 font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors',
                  height < 20 || height > 300 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white',
                ].join(' ')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">мм</span>
            </div>
            <input type="range" min={20} max={300} value={height}
              onChange={(e) => onHeightChange(Number(e.target.value))}
              className="w-full mt-2 h-1.5 bg-gray-200 rounded-full accent-brand-blue cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>20</span><span>300</span>
            </div>
          </div>
        </div>

        {dimensionError ? (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {dimensionError}
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Площадь этикетки: <strong>{areaCm2} см²</strong>
          </p>
        )}
      </div>

      {/* ── Форма высечки ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Форма высечки</h3>
        <p className="text-sm text-gray-500 mb-4">Форма готовой этикетки после вырубки</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CUT_SHAPE_OPTIONS.map((shape) => {
            const isSelected = cutShape === shape;
            return (
              <button
                key={shape}
                onClick={() => onCutShapeChange(shape)}
                className={[
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
                  'hover:shadow-md hover:-translate-y-0.5',
                  isSelected
                    ? 'border-brand-blue bg-blue-50 text-brand-blue shadow-md'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {CUT_SHAPE_ICONS[shape]}
                <span className={['text-xs font-medium', isSelected ? 'text-brand-blue' : 'text-gray-700'].join(' ')}>
                  {CUT_SHAPE_LABELS[shape]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Количество цветов ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Количество цветов</h3>
        <p className="text-sm text-gray-500 mb-4">
          До 4 цветов — стандартная цена. Каждый цвет свыше 4 добавляет +10% к базовой стоимости
        </p>

        <div className="flex items-center gap-4">
          <input
            type="range" min={1} max={12} value={colors}
            onChange={(e) => onColorsChange(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-full accent-brand-blue cursor-pointer"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => onColorsChange(colors - 1)}
              disabled={colors <= 1}
              className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >−</button>
            <div className="w-14 h-8 bg-brand-blue text-white rounded-lg flex items-center justify-center font-bold text-sm tabular-nums">
              {colors}
            </div>
            <button
              onClick={() => onColorsChange(colors + 1)}
              disabled={colors >= 12}
              className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >+</button>
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
          <span>1 цвет</span>
          <span>4 (базовые)</span>
          <span>12 цветов</span>
        </div>

        {colors > 4 && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Надбавка за {colors - 4} доп. {colors - 4 === 1 ? 'цвет' : colors - 4 <= 4 ? 'цвета' : 'цветов'}:{' '}
            <strong>+{(colors - 4) * 10}%</strong> к базовой стоимости
          </div>
        )}
      </div>
    </div>
  );
};