// src/App.tsx
// Корневой компонент приложения калькулятора этикеток flex-n-roll.pro

import React from 'react';
import { Calculator } from './components/Calculator';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Декоративный фон */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-blue/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-orange/5 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 py-8 px-4">
        <Calculator />
      </main>

      <footer className="relative z-10 py-4 text-center text-xs text-gray-400 border-t border-gray-200/50">
        <p>
          © {new Date().getFullYear()}{' '}
          <a href="https://flex-n-roll.pro" target="_blank" rel="noopener noreferrer"
            className="hover:text-brand-blue transition-colors">
            flex-n-roll.pro
          </a>{' '}
          — Производство этикеток
        </p>
      </footer>
    </div>
  );
}

export default App;