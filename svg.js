// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// svg.js — 인라인 SVG 플레이스홀더 (실제 상품 사진 없이 카테고리별 아이콘 생성)

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const shapes = {
  bag: (c) =>
    `<path d="M55 70 h90 a10 10 0 0 1 10 10 v55 a12 12 0 0 1 -12 12 h-86 a12 12 0 0 1 -12 -12 v-55 a10 10 0 0 1 10 -10 z" fill="${shade(c, 18)}"/>
     <path d="M75 70 v-8 a25 25 0 0 1 50 0 v8" fill="none" stroke="${shade(c, 55)}" stroke-width="6"/>
     <rect x="92" y="95" width="16" height="22" rx="4" fill="${shade(c, 60)}"/>`,
  watch: (c) =>
    `<rect x="86" y="34" width="28" height="30" rx="6" fill="${shade(c, 45)}"/>
     <rect x="86" y="136" width="28" height="30" rx="6" fill="${shade(c, 45)}"/>
     <circle cx="100" cy="100" r="46" fill="${shade(c, 25)}" stroke="${shade(c, 65)}" stroke-width="5"/>
     <circle cx="100" cy="100" r="34" fill="${shade(c, 10)}"/>
     <line x1="100" y1="100" x2="100" y2="76" stroke="${shade(c, 90)}" stroke-width="4" stroke-linecap="round"/>
     <line x1="100" y1="100" x2="118" y2="100" stroke="${shade(c, 90)}" stroke-width="4" stroke-linecap="round"/>`,
  jewelry: (c) =>
    `<path d="M100 55 l30 30 -30 60 -30 -60 z" fill="${shade(c, 40)}" stroke="${shade(c, 75)}" stroke-width="3"/>
     <path d="M70 85 h60 l-30 60 z" fill="${shade(c, 20)}"/>
     <line x1="85" y1="70" x2="100" y2="85" stroke="${shade(c, 80)}" stroke-width="2"/>
     <line x1="115" y1="70" x2="100" y2="85" stroke="${shade(c, 80)}" stroke-width="2"/>`,
  clothing: (c) =>
    `<path d="M70 60 l30 -12 30 12 22 18 -16 20 -14 -8 v56 h-44 v-56 l-14 8 -16 -20 z" fill="${shade(c, 22)}" stroke="${shade(c, 55)}" stroke-width="4"/>
     <path d="M100 48 l0 40" stroke="${shade(c, 55)}" stroke-width="3"/>`,
};

/**
 * 아이템용 SVG 플레이스홀더 문자열을 반환합니다.
 * @param {string} category
 * @param {string} color base hex
 * @param {string} [label] 코너 라벨(브랜드 이니셜 등)
 */
export function itemSVG(category, color, label = '') {
  const c = color || '#6b5b73';
  const body = (shapes[category] || shapes.bag)(c);
  const init = (label || '').trim().slice(0, 2).toUpperCase();
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${category} placeholder" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(c, 30)}"/><stop offset="1" stop-color="${shade(c, -30)}"/>
    </linearGradient></defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <rect width="200" height="200" fill="none"/>
    ${body}
    <text x="12" y="188" font-family="Georgia, serif" font-size="13" fill="rgba(255,255,255,.82)">${init}</text>
  </svg>`;
}
