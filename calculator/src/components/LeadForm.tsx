// src/components/LeadForm.tsx
// Форма создания лида в Битрикс24 CRM

import React, { useState } from 'react';
import type { LeadFormData, CalculatorFormState, PriceCalculationResult } from '../types/calculator';
import { useBitrix } from '../hooks/useBitrix';
import { formatCurrency } from '../utils/priceCalc';

interface LeadFormProps {
  formState: CalculatorFormState;
  result: PriceCalculationResult;
  onCancel: () => void;
}

function formatPhone(value: string): string {
  return value.replace(/[^\d+\-\s()]/g, '');
}

export const LeadForm: React.FC<LeadFormProps> = ({ formState, result, onCancel }) => {
  const { isLoading, isSuccess, isError, errorMessage, leadId, submitLead, reset } = useBitrix();

  const [formData, setFormData] = useState<LeadFormData>({
    name: '', company: '', email: '', phone: '',
  });
  const [errors, setErrors] = useState<Partial<LeadFormData>>({});

  const validate = (): boolean => {
    const newErrors: Partial<LeadFormData> = {};
    if (!formData.name.trim()) newErrors.name = 'Введите ваше имя';
    if (!formData.email.trim()) newErrors.email = 'Введите email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Некорректный email-адрес';
    if (!formData.phone.trim()) newErrors.phone = 'Введите номер телефона';
    else if (formData.phone.replace(/\D/g, '').length < 7) newErrors.phone = 'Слишком короткий номер';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await submitLead(formData, formState, result);
  };

  const updateField = (field: keyof LeadFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  if (isSuccess) {
    return (
      <div className="bg-white rounded-2xl border border-green-200 p-6 text-center animate-fadeIn">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Заявка успешно отправлена!</h3>
        <p className="text-gray-600 mb-2">Наш менеджер свяжется с вами в течение 1 рабочего дня.</p>
        {leadId && <p className="text-sm text-gray-400 mb-4">Номер заявки в CRM: <span className="font-mono font-medium">#{leadId}</span></p>}
        <div className="bg-blue-50 rounded-xl p-4 mb-5">
          <p className="text-sm text-gray-600">Расчётная стоимость заказа</p>
          <p className="text-2xl font-extrabold text-brand-blue">{formatCurrency(result.totalCost)}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatCurrency(result.pricePerThousand)} за 1 000 шт. · {result.productionDays}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onCancel} className="py-2.5 px-6 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
            Новый расчёт
          </button>
          <a href="mailto:info@flex-n-roll.pro?subject=Заявка на этикетки"
            className="py-2.5 px-6 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors text-center">
            Написать нам
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Оформить заявку</h3>
          <p className="text-sm text-gray-500 mt-0.5">Менеджер свяжется с вами в течение 1 рабочего дня</p>
        </div>
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Закрыть">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 mb-5 flex items-center justify-between">
        <div><p className="text-xs text-gray-500">Итого</p><p className="text-xl font-extrabold text-brand-blue">{formatCurrency(result.totalCost)}</p></div>
        <div className="text-right"><p className="text-xs text-gray-500">За 1 000 шт.</p><p className="text-lg font-bold text-gray-800">{formatCurrency(result.pricePerThousand)}</p></div>
        <div className="text-right"><p className="text-xs text-gray-500">Срок</p><p className="text-sm font-semibold text-gray-700">{result.productionDays}</p></div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField label="Ваше имя *" error={errors.name} htmlFor="lead-name">
          <input id="lead-name" type="text" placeholder="Иван Иванов" value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className={inputClass(!!errors.name)} autoComplete="name" />
        </FormField>

        <FormField label="Компания" error={errors.company} htmlFor="lead-company">
          <input id="lead-company" type="text" placeholder="ООО «Ваша компания»" value={formData.company}
            onChange={(e) => updateField('company', e.target.value)}
            className={inputClass(!!errors.company)} autoComplete="organization" />
        </FormField>

        <FormField label="Email *" error={errors.email} htmlFor="lead-email">
          <input id="lead-email" type="email" placeholder="ivan@company.ru" value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className={inputClass(!!errors.email)} autoComplete="email" />
        </FormField>

        <FormField label="Телефон *" error={errors.phone} htmlFor="lead-phone">
          <input id="lead-phone" type="tel" placeholder="+7 (999) 123-45-67" value={formData.phone}
            onChange={(e) => updateField('phone', formatPhone(e.target.value))}
            className={inputClass(!!errors.phone)} autoComplete="tel" />
        </FormField>

        {isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Ошибка отправки</p>
              <p className="mt-0.5 text-red-600">{errorMessage}</p>
              <button type="button" onClick={reset} className="mt-1 text-red-700 underline text-xs">Попробовать снова</button>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className={[
              'w-full py-3.5 px-6 font-semibold rounded-xl transition-all duration-200 shadow-md',
              'focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2',
              isLoading
                ? 'bg-orange-300 cursor-wait text-white'
                : 'bg-brand-orange hover:bg-orange-500 text-white hover:shadow-lg hover:-translate-y-0.5',
            ].join(' ')}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Отправляем заявку...
              </span>
            ) : 'Отправить заявку в производство'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">
            Нажимая кнопку, вы соглашаетесь с обработкой персональных данных в соответствии с{' '}
            <a href="https://flex-n-roll.pro/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
              Политикой конфиденциальности
            </a>
          </p>
        </div>
      </form>
    </div>
  );
};

function inputClass(hasError: boolean): string {
  return [
    'w-full px-3 py-2.5 rounded-lg border text-gray-800',
    'focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors placeholder:text-gray-400',
    hasError ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200' : 'border-gray-300 bg-white',
  ].join(' ');
}

function FormField({ label, error, htmlFor, children }: {
  label: string; error?: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}