// src/utils.js
export const createMainAccountId = (name, phone) => {
    if (!name || !phone) return null;
    // 공백 제거 및 하이픈은 그대로 유지
    return `${name.trim()}_${phone.trim()}`;
  };