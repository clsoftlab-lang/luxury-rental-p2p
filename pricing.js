// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// pricing.js — 대여 요금/보증금/기간 산식 (순수 함수, 단위 테스트 대상)
// 모든 함수는 부작용이 없으며 브라우저/Node 양쪽에서 동작합니다.

export const DEFAULT_PRICING = {
  serviceFeeRate: 0.1, // 플랫폼 서비스 수수료 (대여요금 기준)
  insuranceDailyRate: 0.008, // 일일 보험료 (아이템 가치 기준)
  weeklyDiscount: 0.1, // 7일 이상 대여 할인
  monthlyDiscount: 0.2, // 28일 이상 대여 할인
  weeklyThresholdDays: 7,
  monthlyThresholdDays: 28,
  currency: 'KRW',
};

const MS_PER_DAY = 86400000;

/**
 * 두 날짜(포함) 사이의 대여 일수를 계산합니다.
 * 같은 날 반납해도 최소 1일로 계산합니다.
 * @param {string|Date} start ISO date (YYYY-MM-DD) 또는 Date
 * @param {string|Date} end
 * @returns {number} 대여 일수 (>=1), 유효하지 않으면 0
 */
export function rentalDays(start, end) {
  const s = toUTCDate(start);
  const e = toUTCDate(end);
  if (!s || !e) return 0;
  if (e < s) return 0;
  const diff = Math.round((e - s) / MS_PER_DAY);
  return diff + 1; // inclusive
}

function toUTCDate(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
  }
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return null;
}

/**
 * 대여 일수에 따른 할인율을 반환합니다.
 * @returns {number} 0~1 사이 할인율
 */
export function periodDiscount(days, cfg = DEFAULT_PRICING) {
  if (days >= cfg.monthlyThresholdDays) return cfg.monthlyDiscount;
  if (days >= cfg.weeklyThresholdDays) return cfg.weeklyDiscount;
  return 0;
}

/**
 * 손상/분실 보험료를 계산합니다 (선택 시).
 * 아이템 가치(retailValue)의 일정 비율 * 일수.
 */
export function insuranceFee(retailValue, days, cfg = DEFAULT_PRICING) {
  if (!retailValue || days <= 0) return 0;
  return Math.round(retailValue * cfg.insuranceDailyRate * days);
}

/**
 * 전체 대여 견적을 계산합니다.
 * @param {object} p
 * @param {number} p.dailyRate 일일 대여요금
 * @param {number} p.deposit 보증금(환급성)
 * @param {number} p.retailValue 아이템 가치(보험료 산정용)
 * @param {string|Date} p.start
 * @param {string|Date} p.end
 * @param {boolean} [p.insurance] 보험 옵션 선택 여부
 * @param {object} [cfg] 요금 설정
 * @returns {{days,valid,baseFee,discountRate,discountAmount,discountedFee,serviceFee,insurance,rentalTotal,deposit,dueNow,currency}}
 */
export function computeQuote(p, cfg = DEFAULT_PRICING) {
  const days = rentalDays(p.start, p.end);
  const valid = days > 0;
  const dailyRate = Number(p.dailyRate) || 0;
  const deposit = Number(p.deposit) || 0;
  const retailValue = Number(p.retailValue) || 0;

  const baseFee = dailyRate * days;
  const discountRate = periodDiscount(days, cfg);
  const discountAmount = Math.round(baseFee * discountRate);
  const discountedFee = baseFee - discountAmount;
  const serviceFee = Math.round(discountedFee * cfg.serviceFeeRate);
  const insurance = p.insurance ? insuranceFee(retailValue, days, cfg) : 0;
  const rentalTotal = discountedFee + serviceFee + insurance;
  const dueNow = rentalTotal + deposit; // 보증금은 예치(환급성)

  return {
    days,
    valid,
    baseFee,
    discountRate,
    discountAmount,
    discountedFee,
    serviceFee,
    insurance,
    rentalTotal,
    deposit,
    dueNow,
    currency: cfg.currency,
  };
}

/**
 * 통화 포맷 (KRW).
 */
export function formatKRW(n) {
  const v = Math.round(Number(n) || 0);
  return '₩' + v.toLocaleString('ko-KR');
}
