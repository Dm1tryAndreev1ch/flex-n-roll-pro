// src/components/Calculator.tsx
// Главный компонент калькулятора — управляет wizard-навигацией

import React from 'react';
import { useCalculator } from '../hooks/useCalculator';
import { StepOne } from './StepOne';
import { StepTwo } from './StepTwo';
import { StepThree } from './StepThree';
import { PriceResult } from './PriceResult';

const STEPS = [
  { number: 1, title: 'Тип и материал' },
  { number: 2, title: 'Параметры' },
  { number: 3, title: 'Тираж и отделка' },
];

export const Calculator: React.FC = () => {
  const {
    formState, currentStep, result, canProceed,
    setLabelType, setMaterial, setWidth, setHeight,
    setCutShape, setColors, toggleFinishing,
    setCirculation, setHasDesign,
    goToNextStep, goToPrevStep, goToStep, resetCalculator,
  } = useCalculator();

  const isResultStep = currentStep === 'result';
  const progressPercent = isResultStep ? 100 : ((currentStep as number) / 3) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* ── Заголовок ─────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="flex-n-roll логотип">
            <rect width="44" height="44" rx="10" fill="#1A3C8F" />
            <rect x="8" y="14" width="28" height="4" rx="2" fill="#F4821E" />
            <rect x="8" y="22" width="20" height="4" rx="2" fill="white" />
            <rect x="8" y="30" width="24" height="4" rx="2" fill="white" fillOpacity="0.6" />
            <circle cx="36" cy="32" r="4" fill="#F4821E" />
          </svg>
          <div className="text-left">
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
              flex-n-roll<span className="text-brand-blue">.pro</span>
            </h1>
            <p className="text-xs text-gray-500 -mt-0.5">Производство этикеток</p>
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-800">Калькулятор стоимости этикеток</h2>
        <p className="text-sm text-gray-500 mt-1">Рассчитайте стоимость тиража за 3 шага</p>
      </div>

      {/* ── Индикатор шагов ───────────────────────────────────────────── */}
      {!isResultStep && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step, idx) => {
              const isCompleted = (currentStep as number) > step.number;
              const isActive = currentStep === step.number;
              const isClickable = isCompleted;
              return (
                <React.Fragment key={step.number}>
                  <button
                    onClick={() => isClickable && goToStep(step.number as 1 | 2 | 3)}
                    disabled={!isClickable}
                    className={['flex flex-col items-center gap-1.5', isClickable ? 'cursor-pointer' : 'cursor-default'].join(' ')}
                  >
                    <div className={[
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                      isCompleted ? 'bg-brand-blue text-white shadow-md'
                        : isActive ? 'bg-brand-orange text-white shadow-md ring-4 ring-orange-200'
                        : 'bg-gray-100 text-gray-400',
                    ].join(' ')}>
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : step.number}
                    </div>
                    <span className={[
                      'text-xs font-medium hidden sm:block',
                      isActive ? 'text-brand-orange' : isCompleted ? 'text-brand-blue' : 'text-gray-400',
                    ].join(' ')}>
                      {step.title}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 mx-2 h-0.5 rounded-full overflow-hidden bg-gray-200">
                      <div
                        className="h-full bg-brand-blue transition-all duration-500"
                        style={{ width: (currentStep as number) > step.number ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-blue to-brand-orange rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Карточка калькулятора ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Шапка */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
              isResultStep ? 'bg-green-500 text-white' : 'bg-brand-orange text-white',
            ].join(' ')}>
              {isResultStep ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : currentStep}
            </span>
            <h3 className="font-bold text-gray-800">
              {isResultStep ? 'Результат расчёта' : STEPS.find((s) => s.number === currentStep)?.title}
            </h3>
            {!isResultStep && <span className="ml-auto text-xs text-gray-400">Шаг {currentStep} из 3</span>}
          </div>
        </div>

        {/* Содержимое */}
        <div className="p-6">
          {currentStep === 1 && (
            <StepOne
              selectedType={formState.labelType} selectedMaterial={formState.material}
              onTypeChange={setLabelType} onMaterialChange={setMaterial}
            />
          )}
          {currentStep === 2 && (
            <StepTwo
              width={formState.width} height={formState.height}
              cutShape={formState.cutShape} colors={formState.colors}
              onWidthChange={setWidth} onHeightChange={setHeight}
              onCutShapeChange={setCutShape} onColorsChange={setColors}
            />
          )}
          {currentStep === 3 && (
            <StepThree
              finishing={formState.finishing} circulation={formState.circulation}
              hasDesign={formState.hasDesign}
              onFinishingToggle={toggleFinishing}
              onCirculationChange={setCirculation}
              onHasDesignChange={setHasDesign}
            />
          )}
          {isResultStep && result && (
            <PriceResult result={result} formState={formState} onRecalculate={resetCalculator} />
          )}
        </div>

        {/* Кнопки навигации */}
        {!isResultStep && (
          <div className="px-6 pb-6 flex items-center justify-between gap-4">
            <button
              onClick={goToPrevStep}
              disabled={(currentStep as number) <= 1}
              className={[
                'flex items-center gap-2 py-2.5 px-5 rounded-xl font-medium text-sm transition-all duration-200',
                (currentStep as number) <= 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад
            </button>

            <button
              onClick={goToNextStep}
              disabled={!canProceed}
              className={[
                'flex items-center gap-2 py-3 px-8 rounded-xl font-semibold text-sm transition-all duration-200 shadow',
                !canProceed
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : currentStep === 3
                  ? 'bg-brand-orange hover:bg-orange-500 text-white hover:shadow-lg hover:-translate-y-0.5'
                  : 'bg-brand-blue hover:bg-blue-700 text-white hover:shadow-lg hover:-translate-y-0.5',
              ].join(' ')}
            >
              {currentStep === 3 ? (
                <>
                  Рассчитать стоимость
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </>
              ) : (
                <>
                  Далее
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Доверительные индикаторы ──────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
        {['Собственное производство', 'Доставка по всему миру', 'Сертификаты ISO 9001', 'Ответ менеджера за 1 час'].map((text) => (
          <span key={text} className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};