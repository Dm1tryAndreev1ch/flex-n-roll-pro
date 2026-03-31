// src/hooks/useCalculator.ts
// Хук управления состоянием калькулятора и логикой переходов между шагами

import { useState, useCallback } from 'react';
import type {
  CalculatorFormState,
  PriceCalculationResult,
  WizardStep,
  LabelType,
  Material,
  CutShape,
  Finishing,
  Circulation,
} from '../types/calculator';
import { calculatePrice, canProceedFromStep } from '../utils/priceCalc';

// Начальное состояние формы
const INITIAL_STATE: CalculatorFormState = {
  labelType: null,
  material: null,
  width: 100,          // мм — значение по умолчанию
  height: 150,         // мм — значение по умолчанию
  cutShape: null,
  colors: 4,           // 4 цвета — самый распространённый вариант
  finishing: [],
  circulation: null,
  hasDesign: null,
};

interface UseCalculatorReturn {
  formState: CalculatorFormState;
  currentStep: WizardStep;
  result: PriceCalculationResult | null;
  canProceed: boolean;
  setLabelType: (type: LabelType) => void;
  setMaterial: (material: Material) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setCutShape: (shape: CutShape) => void;
  setColors: (colors: number) => void;
  toggleFinishing: (finishing: Finishing) => void;
  setCirculation: (circulation: Circulation) => void;
  setHasDesign: (hasDesign: boolean) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  goToStep: (step: WizardStep) => void;
  resetCalculator: () => void;
}

export function useCalculator(): UseCalculatorReturn {
  const [formState, setFormState] = useState<CalculatorFormState>(INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [result, setResult] = useState<PriceCalculationResult | null>(null);

  const canProceed =
    typeof currentStep === 'number'
      ? canProceedFromStep(currentStep, formState)
      : false;

  const setLabelType = useCallback((type: LabelType) => {
    setFormState((prev) => ({ ...prev, labelType: type }));
  }, []);

  const setMaterial = useCallback((material: Material) => {
    setFormState((prev) => ({ ...prev, material }));
  }, []);

  const setWidth = useCallback((width: number) => {
    setFormState((prev) => ({ ...prev, width }));
  }, []);

  const setHeight = useCallback((height: number) => {
    setFormState((prev) => ({ ...prev, height }));
  }, []);

  const setCutShape = useCallback((cutShape: CutShape) => {
    setFormState((prev) => ({ ...prev, cutShape }));
  }, []);

  const setColors = useCallback((colors: number) => {
    setFormState((prev) => ({ ...prev, colors: Math.min(12, Math.max(1, colors)) }));
  }, []);

  /**
   * Переключение финишинга (мультиселект).
   * Если 'none' выбирается — снимаем все остальные.
   * Если выбирается что-то другое — снимаем 'none'.
   */
  const toggleFinishing = useCallback((finishing: Finishing) => {
    setFormState((prev) => {
      const current = prev.finishing;

      if (finishing === 'none') {
        return { ...prev, finishing: ['none'] };
      }

      const withoutNone = current.filter((f) => f !== 'none');

      if (withoutNone.includes(finishing)) {
        const updated = withoutNone.filter((f) => f !== finishing);
        return { ...prev, finishing: updated.length === 0 ? ['none'] : updated };
      } else {
        return { ...prev, finishing: [...withoutNone, finishing] };
      }
    });
  }, []);

  const setCirculation = useCallback((circulation: Circulation) => {
    setFormState((prev) => ({ ...prev, circulation }));
  }, []);

  const setHasDesign = useCallback((hasDesign: boolean) => {
    setFormState((prev) => ({ ...prev, hasDesign }));
  }, []);

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === 1) return 2;
      if (prev === 2) return 3;
      if (prev === 3) {
        // Выполняем расчёт при переходе к результату
        const calculatedResult = calculatePrice(formState);
        setResult(calculatedResult);
        return 'result';
      }
      return prev;
    });
  }, [formState]);

  const goToPrevStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === 'result') return 3;
      if (prev === 3) return 2;
      if (prev === 2) return 1;
      return prev;
    });
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const resetCalculator = useCallback(() => {
    setFormState(INITIAL_STATE);
    setCurrentStep(1);
    setResult(null);
  }, []);

  return {
    formState,
    currentStep,
    result,
    canProceed,
    setLabelType,
    setMaterial,
    setWidth,
    setHeight,
    setCutShape,
    setColors,
    toggleFinishing,
    setCirculation,
    setHasDesign,
    goToNextStep,
    goToPrevStep,
    goToStep,
    resetCalculator,
  };
}