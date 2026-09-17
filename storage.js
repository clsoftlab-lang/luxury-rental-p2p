// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// storage.js — localStorage 래퍼 (try/catch 안전 처리 + 초기화)
// 데모 모드: 실제 DB가 아니라 브라우저 로컬 저장소를 사용합니다.

const PREFIX = 'lrp2p:';
export const KEYS = {
  listings: PREFIX + 'listings', // 사용자가 등록한 아이템
  bookings: PREFIX + 'bookings', // 예약 내역
  wishlist: PREFIX + 'wishlist', // 위시리스트 (id 배열)
  reviews: PREFIX + 'reviews', // 사용자 작성 리뷰 { [itemId]: [..] }
};

function available() {
  try {
    const k = PREFIX + '__t';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const storageAvailable = available();

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function push(key, value) {
  const arr = read(key, []);
  arr.push(value);
  write(key, arr);
  return arr;
}

export function toggleInArray(key, value) {
  const arr = read(key, []);
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(value);
  write(key, arr);
  return arr;
}

/** 데모 데이터 전체 초기화 */
export function resetAll() {
  try {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    return true;
  } catch {
    return false;
  }
}
