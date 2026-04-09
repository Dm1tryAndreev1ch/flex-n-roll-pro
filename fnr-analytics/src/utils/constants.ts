export const BITRIX_STAGES: Record<string, { label: string, color: string }> = {
  "NEW": { label: "Новая", color: "gray" },
  "PREPARATION": { label: "Подготовка", color: "blue" },
  "PREPAYMENT_INVOICE": { label: "Счет на предоплату", color: "blue" },
  "EXECUTING": { label: "В работе", color: "blue" },
  "FINAL_INVOICE": { label: "Финальный счет", color: "amber" },
  "WON": { label: "Сделка успешна", color: "green" },
  "LOSE": { label: "Сделка провалена", color: "red" },
  "APOLOGY": { label: "Сделка провалена", color: "red" },
  
  // Custom pipeline stages (flexible)
  "C3:NEW": { label: "Новая (Производство)", color: "gray" },
  "C3:PREPARATION": { label: "На маркировке", color: "blue" },
  "C3:EXECUTING": { label: "В производстве", color: "blue" },
  "C3:WON": { label: "Отгружено", color: "green" },
  "C3:LOSE": { label: "Отменено", color: "red" },
};

export const getStageInfo = (stageId: string) => {
  if (!stageId) return { label: "Неизвестно", color: "gray" };
  if (BITRIX_STAGES[stageId]) return BITRIX_STAGES[stageId];
  
  // Default parsing for unknown custom stages
  if (stageId.includes('WON')) return { label: stageId, color: "green" };
  if (stageId.includes('LOSE')) return { label: stageId, color: "red" };
  
  return { label: stageId, color: "blue" };
};
