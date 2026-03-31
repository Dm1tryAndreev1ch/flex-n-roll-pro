// src/hooks/useBitrix.ts
// Хук интеграции с Битрикс24 CRM — создание лидов через бэкенд-прокси

import { useState, useCallback } from 'react';
import axios from 'axios';
import type {
  BitrixLeadPayload,
  BitrixApiResponse,
  LeadFormData,
  CalculatorFormState,
  PriceCalculationResult,
} from '../types/calculator';
import {
  LABEL_TYPE_LABELS,
  MATERIAL_LABELS,
  FINISHING_LABELS,
  CIRCULATION_LABELS,
} from '../data/pricing';
import { formatCurrency } from '../utils/priceCalc';

// URL бэкенд-прокси (Node.js/Express server.js)
// В продакшене проксируется через nginx/vite
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface UseBitrixReturn {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  errorMessage: string | null;
  leadId: number | null;
  submitLead: (
    formData: LeadFormData,
    calculatorData: CalculatorFormState,
    result: PriceCalculationResult
  ) => Promise<void>;
  reset: () => void;
}

export function useBitrix(): UseBitrixReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);

  /** Формирует текстовый комментарий для лида */
  const buildLeadComments = (
    calculatorData: CalculatorFormState,
    result: PriceCalculationResult
  ): string => {
    const lines: string[] = [
      '=== ПАРАМЕТРЫ ЗАКАЗА ===',
      `Тип этикетки: ${calculatorData.labelType ? LABEL_TYPE_LABELS[calculatorData.labelType] : '—'}`,
      `Материал: ${calculatorData.material ? MATERIAL_LABELS[calculatorData.material] : '—'}`,
      `Размер: ${calculatorData.width} × ${calculatorData.height} мм`,
      `Количество цветов: ${calculatorData.colors}`,
      `Отделка: ${calculatorData.finishing.map((f) => FINISHING_LABELS[f]).join(', ')}`,
      `Тираж: ${calculatorData.circulation ? CIRCULATION_LABELS[calculatorData.circulation] : '—'}`,
      `Наличие макета: ${calculatorData.hasDesign ? 'Есть готовый' : 'Нужна разработка'}`,
      '',
      '=== РАСЧЁТ СТОИМОСТИ ===',
      `Базовая стоимость: ${formatCurrency(result.baseCost)}`,
      `Финишинг: ${formatCurrency(result.finishingCost)}`,
      `Подготовка (препресс): ${formatCurrency(result.setupCost)}`,
      result.designCost > 0 ? `Разработка макета: ${formatCurrency(result.designCost)}` : '',
      `Скидка по тиражу: -${result.discountRate}% (${formatCurrency(result.discountAmount)})`,
      `ИТОГО: ${formatCurrency(result.totalCost)}`,
      `Цена за 1000 шт.: ${formatCurrency(result.pricePerThousand)}`,
      `Срок производства: ${result.productionDays}`,
    ];
    return lines.filter(Boolean).join('\n');
  };

  /**
   * Отправляет лид через бэкенд-прокси на Битрикс24
   */
  const submitLead = useCallback(
    async (
      formData: LeadFormData,
      calculatorData: CalculatorFormState,
      result: PriceCalculationResult
    ) => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);

      const payload: BitrixLeadPayload = { formData, calculatorData, result };

      try {
        const response = await axios.post<BitrixApiResponse>(
          `${API_BASE_URL}/api/bitrix/lead`,
          payload,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
          }
        );

        if (response.data.success) {
          setIsSuccess(true);
          if (response.data.leadId) {
            setLeadId(response.data.leadId);
          }
        } else {
          throw new Error(response.data.error || 'Неизвестная ошибка');
        }
      } catch (error) {
        setIsError(true);

        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED') {
            setErrorMessage('Превышено время ожидания. Проверьте соединение с интернетом.');
          } else if (error.response) {
            setErrorMessage(
              error.response.data?.error || `Ошибка сервера: ${error.response.status}`
            );
          } else if (error.request) {
            setErrorMessage('Сервер недоступен. Попробуйте позже.');
          } else {
            setErrorMessage(error.message);
          }
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Произошла неизвестная ошибка при отправке заявки.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
    setErrorMessage(null);
    setLeadId(null);
  }, []);

  return { isLoading, isSuccess, isError, errorMessage, leadId, submitLead, reset };
}