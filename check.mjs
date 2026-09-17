// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// check.mjs — CI 검증: JSON 파싱, index.html 필수 컨테이너, pricing.js 산식 단위 테스트.
// (node --check 로 전체 JS 문법 검사는 CI 워크플로우에서 별도 수행)

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  rentalDays, periodDiscount, insuranceFee, computeQuote, formatKRW, DEFAULT_PRICING,
} from './pricing.js';

const root = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; fails.push(msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (기대 ${b}, 실제 ${a})`); }

// ---------- 1. JSON 파일 파싱 ----------
const dataDir = join(root, 'data');
const jsonFiles = readdirSync(dataDir).filter((f) => f.endsWith('.json'));
ok(jsonFiles.length >= 2, 'data/*.json 이 2개 이상 존재');
let itemsJson;
for (const f of jsonFiles) {
  try {
    const parsed = JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
    pass++;
    if (f === 'items.json') itemsJson = parsed;
  } catch (e) {
    fail++; fails.push(`JSON 파싱 실패: ${f} — ${e.message}`);
  }
}
ok(itemsJson && Array.isArray(itemsJson.items), 'items.json 에 items 배열 존재');
ok(itemsJson && itemsJson.items.length >= 36, `아이템 36개 이상 (실제 ${itemsJson ? itemsJson.items.length : 0})`);
if (itemsJson) {
  const cats = new Set(itemsJson.items.map((i) => i.category));
  ['bag', 'watch', 'jewelry', 'clothing'].forEach((c) => ok(cats.has(c), `카테고리 ${c} 존재`));
  const verified = itemsJson.items.filter((i) => i.authenticity && i.authenticity.status === 'verified').length;
  ok(verified > 0, '정품 인증(verified) 아이템 존재');
  ok(itemsJson.items.every((i) => i.id && i.brand && i.dailyRate >= 0 && i.deposit >= 0), '모든 아이템 필수 필드 보유');
  const ids = itemsJson.items.map((i) => i.id);
  eq(new Set(ids).size, ids.length, '아이템 ID 중복 없음');
}

// ---------- 2. index.html 필수 컨테이너 ----------
const html = readFileSync(join(root, 'index.html'), 'utf8');
ok(/<div[^>]*id=["']app["']/.test(html), 'index.html 에 #app 컨테이너 존재');
ok(/type=["']module["'][^>]*src=["']\.\/app\.js["']/.test(html) || /src=["']\.\/app\.js["'][^>]*type=["']module["']/.test(html), 'app.js 모듈 로드');
ok(/href=["']\.\/styles\.css["']/.test(html), 'styles.css 링크');
ok(/lang=["']ko["']/.test(html), 'lang=ko 설정');

// ---------- 3. pricing.js 산식 단위 테스트 ----------
// rentalDays: inclusive
eq(rentalDays('2026-10-01', '2026-10-01'), 1, 'rentalDays 같은날=1일');
eq(rentalDays('2026-10-01', '2026-10-03'), 3, 'rentalDays 3일 inclusive');
eq(rentalDays('2026-10-05', '2026-10-01'), 0, 'rentalDays 역순=0(무효)');
eq(rentalDays('bad', '2026-10-01'), 0, 'rentalDays 잘못된 입력=0');

// periodDiscount
eq(periodDiscount(3), 0, '3일 할인 없음');
eq(periodDiscount(7), DEFAULT_PRICING.weeklyDiscount, '7일 주간 할인');
eq(periodDiscount(28), DEFAULT_PRICING.monthlyDiscount, '28일 월간 할인');
eq(periodDiscount(30), DEFAULT_PRICING.monthlyDiscount, '30일 월간 할인');

// insuranceFee
eq(insuranceFee(1000000, 5), Math.round(1000000 * 0.008 * 5), '보험료 = 가치*요율*일수');
eq(insuranceFee(0, 5), 0, '가치 0이면 보험료 0');
eq(insuranceFee(1000000, 0), 0, '일수 0이면 보험료 0');

// computeQuote — 3일 대여, 할인 없음, 보험 없음
{
  const q = computeQuote({ dailyRate: 100000, deposit: 500000, retailValue: 3000000, start: '2026-10-01', end: '2026-10-03', insurance: false });
  eq(q.days, 3, 'quote 일수 3');
  eq(q.baseFee, 300000, 'quote 기본요금 30만');
  eq(q.discountAmount, 0, 'quote 할인 0');
  eq(q.serviceFee, 30000, 'quote 서비스수수료 10%');
  eq(q.insurance, 0, 'quote 보험 0');
  eq(q.rentalTotal, 330000, 'quote 대여합계 = 기본+수수료');
  eq(q.dueNow, 830000, 'quote 결제예정 = 대여합계+보증금');
  eq(q.deposit, 500000, 'quote 보증금 유지');
}
// computeQuote — 7일 대여(주간 할인 10%) + 보험
{
  const q = computeQuote({ dailyRate: 100000, deposit: 500000, retailValue: 1000000, start: '2026-10-01', end: '2026-10-07', insurance: true });
  eq(q.days, 7, 'quote 7일');
  eq(q.baseFee, 700000, 'quote 기본 70만');
  eq(q.discountRate, 0.1, 'quote 주간할인율 10%');
  eq(q.discountAmount, 70000, 'quote 할인액 7만');
  eq(q.discountedFee, 630000, 'quote 할인후 63만');
  eq(q.serviceFee, 63000, 'quote 수수료 = 할인후*10%');
  eq(q.insurance, Math.round(1000000 * 0.008 * 7), 'quote 보험료 계산');
  eq(q.rentalTotal, 630000 + 63000 + 56000, 'quote 대여합계 = 할인후+수수료+보험');
  eq(q.dueNow, q.rentalTotal + 500000, 'quote 결제예정 포함 보증금');
}
// computeQuote — 무효 구간
{
  const q = computeQuote({ dailyRate: 100000, deposit: 0, retailValue: 0, start: null, end: null });
  eq(q.valid, false, 'quote 날짜 없으면 무효');
  eq(q.days, 0, 'quote 무효 일수 0');
}
// formatKRW
eq(formatKRW(1234567), '₩1,234,567', 'formatKRW 천단위 콤마');
eq(formatKRW(0), '₩0', 'formatKRW 0원');

// ---------- 결과 ----------
console.log(`\ncheck.mjs — PASS ${pass} / FAIL ${fail}`);
if (fail) {
  console.error('\n실패 항목:');
  fails.forEach((f) => console.error('  ✗ ' + f));
  process.exit(1);
}
console.log('✓ 모든 검증 통과');
