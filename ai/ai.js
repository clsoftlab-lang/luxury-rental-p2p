// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/ai.js — 프론트엔드 AI 클라이언트 (플러그블).
//
//   askAI(task, payload, { onToken })
//
//   • AI_ENDPOINT 가 비어 있으면  ⇒  결정론적 한국어 MockProvider 로 응답합니다.
//     - 앱의 실제 아이템 카탈로그(payload.items) + pricing.js 견적 엔진을 재사용합니다.
//     - 네트워크/키가 전혀 필요 없으며 데모에서 항상 동작합니다.
//   • AI_ENDPOINT 가 설정되면  ⇒  { task, payload } 를 백엔드 프록시로 POST 하고
//     응답 본문을 스트리밍으로 읽어 onToken 으로 흘려보냅니다.
//     실제 Claude 호출과 API 키는 오직 백엔드(server/)에만 존재합니다.
//   • 무인(autonomous) 안전장치: 엔드포인트 호출 실패 / 429 {fallback:true} / 네트워크 오류 시
//     자동으로 목업(MockProvider)으로 폴백하여 앱이 절대 멈추지 않습니다.
//
// 지원 task: "chat"(대여 상담 챗봇), "styling"(코디/스타일링 추천), "authenticity"(정품 인증·안전 거래 안내)

import { AI_ENDPOINT } from './config.js';
import { computeQuote, formatKRW, rentalDays } from '../pricing.js';

/**
 * @param {"chat"|"styling"|"authenticity"} task
 * @param {object} payload
 * @param {{onToken?: (chunk:string)=>void}} [opts]
 * @returns {Promise<string>} 전체 응답 텍스트
 */
export async function askAI(task, payload = {}, { onToken } = {}) {
  if (!AI_ENDPOINT) {
    return mockProvider(task, payload, onToken);
  }
  // ---- 실 연동: 백엔드 프록시로 POST 후 스트리밍 ----
  //   실패/429{fallback:true}/네트워크 오류 → 목업으로 자동 폴백(무인, 앱이 멈추지 않음).
  let full = '';
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, payload }),
    });
    // 429 {fallback:true}(비용 가드레일) 또는 기타 실패 응답 → 아직 출력 전이면 목업 폴백
    if (!res.ok || !res.body) {
      return mockProvider(task, payload, onToken);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) { full += chunk; if (onToken) onToken(chunk); }
    }
    const tail = decoder.decode();
    if (tail) { full += tail; if (onToken) onToken(tail); }
    return full;
  } catch (err) {
    // 네트워크 오류 등 — 아직 아무 것도 스트리밍하지 않았으면 목업으로 폴백(무인)
    if (!full) return mockProvider(task, payload, onToken);
    return full;
  }
}

export const AI_TASKS = Object.freeze(['chat', 'styling', 'authenticity']);
export function isMock() { return !AI_ENDPOINT; }

// ======================================================================
//  MockProvider — 결정론적 한국어 응답 (앱 데이터 + pricing 엔진 재사용)
// ======================================================================

async function mockProvider(task, payload, onToken) {
  let text;
  if (task === 'styling') text = mockStyling(payload);
  else if (task === 'authenticity') text = mockAuthenticity(payload);
  else text = mockChat(payload); // 기본: 대여 상담 챗봇
  return streamOut(text, onToken);
}

// 텍스트를 작은 조각으로 나눠 onToken 으로 흘려보냄 (스트리밍 UX 재현, 내용은 결정론적)
async function streamOut(text, onToken) {
  if (!onToken) return text;
  const parts = text.match(/[\s\S]{1,4}/g) || [text];
  for (const p of parts) {
    onToken(p);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 6));
  }
  return text;
}

const CAT_KO = { bag: '가방', watch: '시계', jewelry: '주얼리', clothing: '의류' };

// 메시지에서 카테고리 힌트 추출 (결정론적 키워드 매칭)
function detectCategory(s) {
  const t = String(s || '').toLowerCase();
  if (/(가방|백|토트|숄더|clutch|클러치|bag)/.test(t)) return 'bag';
  if (/(시계|워치|watch|손목)/.test(t)) return 'watch';
  if (/(주얼리|목걸이|반지|귀걸이|팔찌|jewel)/.test(t)) return 'jewelry';
  if (/(의류|옷|드레스|코트|자켓|재킷|정장|clothing|dress)/.test(t)) return 'clothing';
  return null;
}

// 상황(occasion) 추출
function detectOccasion(s) {
  const t = String(s || '');
  if (/(결혼|웨딩|하객|예식)/.test(t)) return { key: 'wedding', ko: '결혼식/하객', pref: ['jewelry', 'clothing', 'bag'] };
  if (/(파티|연말|갈라|행사)/.test(t)) return { key: 'party', ko: '파티/행사', pref: ['jewelry', 'clothing', 'watch'] };
  if (/(데이트|기념일|생일)/.test(t)) return { key: 'date', ko: '데이트/기념일', pref: ['bag', 'jewelry', 'clothing'] };
  if (/(여행|휴가|바캉스)/.test(t)) return { key: 'travel', ko: '여행/휴가', pref: ['bag', 'watch', 'clothing'] };
  if (/(면접|비즈니스|미팅|출장|발표)/.test(t)) return { key: 'business', ko: '비즈니스/면접', pref: ['watch', 'bag', 'clothing'] };
  return null;
}

// 예산(일일요금 상한) 추출: "10만", "150000", "20만원" 등
function detectBudget(s) {
  const t = String(s || '').replace(/[, ]/g, '');
  let m = t.match(/(\d+)\s*만/); // n만(원)
  if (m) return Number(m[1]) * 10000;
  m = t.match(/(\d{4,})\s*원?/); // 원 단위 숫자
  if (m) return Number(m[1]);
  return null;
}

function parseIso(s) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(String(s || ''));
  return m ? m[1] : null;
}

// 결정론적 정렬: 평점 → 리뷰수 → id
function byQuality(a, b) {
  return (b.rating - a.rating) || ((b.reviewsCount || 0) - (a.reviewsCount || 0)) || String(a.id).localeCompare(String(b.id));
}

// ---------- (1) 대여 상담 챗봇 ----------
function mockChat(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const message = payload.message || '';
  const cat = payload.category || detectCategory(message);
  const occ = payload.occasion ? { key: payload.occasion, ko: payload.occasion, pref: [] } : detectOccasion(message);
  const budget = payload.budget != null ? Number(payload.budget) : detectBudget(message);
  const start = parseIso(payload.dates && payload.dates.start) || parseIso(message);
  const end = parseIso(payload.dates && payload.dates.end);
  const days = start && end ? rentalDays(start, end) : 0;

  if (!items.length) {
    return '지금은 카탈로그를 불러오지 못했어요. 잠시 후 다시 시도해 주세요. (데모 · 목업 응답)';
  }

  // 후보 필터링
  let pool = items.slice();
  if (cat) pool = pool.filter((i) => i.category === cat);
  if (budget) pool = pool.filter((i) => i.dailyRate <= budget);
  // 인증 완료 우선
  const preferVerified = pool.filter((i) => i.authenticity && i.authenticity.status === 'verified');
  const base = preferVerified.length >= 3 ? preferVerified : pool;
  let ranked = base.slice().sort(byQuality);
  // 상황 선호 카테고리로 가중(카테고리 미지정 시)
  if (!cat && occ && occ.pref.length) {
    ranked = ranked.sort((a, b) => {
      const wa = occ.pref.indexOf(a.category); const wb = occ.pref.indexOf(b.category);
      const na = wa < 0 ? 99 : wa; const nb = wb < 0 ? 99 : wb;
      return na - nb || byQuality(a, b);
    });
  }
  const picks = ranked.slice(0, 3);

  const lines = [];
  lines.push('안녕하세요, LuxeLoop 대여 상담 도우미예요. (데모 · 목업 응답)');
  const ctx = [];
  if (occ) ctx.push(`상황: ${occ.ko}`);
  if (cat) ctx.push(`카테고리: ${CAT_KO[cat]}`);
  if (budget) ctx.push(`일일 예산: ${formatKRW(budget)} 이하`);
  if (days > 0) ctx.push(`대여 기간: ${start} ~ ${end} (${days}일)`);
  if (ctx.length) lines.push('요청하신 조건 — ' + ctx.join(' · ') + ' 을(를) 반영했어요.');

  if (!picks.length) {
    lines.push('');
    lines.push('아쉽게도 조건에 딱 맞는 아이템을 찾지 못했어요. 예산을 조금 올리거나 카테고리를 넓혀보시겠어요?');
    lines.push('예: "결혼식 하객룩, 일일 12만원 이하 주얼리 추천해줘"');
    return lines.join('\n');
  }

  lines.push('');
  lines.push(`조건에 맞는 추천 ${picks.length}가지예요:`);
  picks.forEach((it, idx) => {
    lines.push('');
    lines.push(`${idx + 1}. ${it.brand} · ${it.name} (${CAT_KO[it.category] || it.categoryKo})`);
    const bits = [`일일 ${formatKRW(it.dailyRate)}`, `보증금 ${formatKRW(it.deposit)}`, `상태 ${it.condition}등급`, `평점 ${it.rating}`];
    lines.push('   ' + bits.join(' · '));
    const verified = it.authenticity && it.authenticity.status === 'verified';
    lines.push('   ' + (verified ? '✓ 정품 인증 완료(데모) — 안심하고 예약할 수 있어요.' : '⧗ 정품 인증 대기 — 예약 시 인증 완료 후 발송을 권장해요.'));
    if (days > 0) {
      const q = computeQuote({ dailyRate: it.dailyRate, deposit: it.deposit, retailValue: it.retailValue, start, end, insurance: !!it.insuranceEligible }, payload.pricing);
      lines.push(`   ${days}일 예상 결제 ${formatKRW(q.dueNow)} (대여 ${formatKRW(q.rentalTotal)} + 보증금 ${formatKRW(q.deposit)}${q.discountAmount > 0 ? `, 기간할인 -${Math.round(q.discountRate * 100)}%` : ''})`);
    }
  });

  lines.push('');
  lines.push('마음에 드는 아이템을 열어 캘린더에서 날짜를 고르면 요금이 자동 계산돼요. 정품 인증·보증금·보험 흐름은 "안전장치" 페이지에서 확인하세요.');
  lines.push('');
  lines.push('※ 모든 브랜드는 가상이며 실제 거래·결제는 발생하지 않는 데모입니다.');
  return lines.join('\n');
}

// ---------- (2) 코디/스타일링 추천 서술 ----------
function mockStyling(payload) {
  const it = payload.item;
  if (!it) return '스타일링을 추천할 아이템 정보를 찾지 못했어요. (데모 · 목업 응답)';
  const items = Array.isArray(payload.items) ? payload.items : [];
  const cat = it.category;

  const palette = {
    bag: '데일리 캐주얼부터 오피스룩까지 넓게 어울려요. 톤온톤 니트 + 슬랙스에 이 가방으로 포인트를 주면 손쉽게 완성도가 올라갑니다.',
    watch: '셔츠 소매 아래로 살짝 드러나는 연출이 가장 세련돼요. 미니멀한 룩에 하나만 더해도 시선이 손목으로 모입니다.',
    jewelry: '목선이 드러나는 상의나 심플한 원피스와 매치하면 주얼리가 주인공이 됩니다. 과한 액세서리는 덜어내는 게 포인트예요.',
    clothing: '이너와 슈즈를 무채색으로 정리하면 이 아이템의 실루엣이 가장 돋보여요. 오버사이즈는 하의를 슬림하게 잡아 균형을 맞추세요.',
  };

  // 같은 상황에 함께 매치할 보완 아이템(다른 카테고리) 1~2개 추천 — 결정론적
  const companions = items
    .filter((x) => x.id !== it.id && x.category !== cat && x.authenticity && x.authenticity.status === 'verified')
    .sort(byQuality)
    .slice(0, 2);

  const lines = [];
  lines.push(`${it.brand} · ${it.name} 코디 제안 (데모 · 목업 응답)`);
  lines.push('');
  lines.push(`이 ${CAT_KO[cat] || it.categoryKo}은(는) 상태 ${it.condition}등급으로 컨디션이 좋아, 특별한 날 부담 없이 즐기기 좋아요.`);
  lines.push(palette[cat] || palette.bag);
  lines.push('');
  lines.push('추천 3-룩:');
  lines.push(`• 데일리 — 무채색 베이직에 ${it.brand} ${CAT_KO[cat] || '아이템'} 하나로 포인트.`);
  lines.push('• 오피스 — 셋업 슈트에 매치해 단정하면서 개성 있게.');
  lines.push('• 이벤트 — 톤을 맞춘 드레시 룩으로 완성도 높이기.');
  if (companions.length) {
    lines.push('');
    lines.push('함께 빌리면 좋은 아이템(정품 인증 완료):');
    companions.forEach((c) => lines.push(`• ${c.brand} · ${c.name} (${CAT_KO[c.category] || c.categoryKo}, 일일 ${formatKRW(c.dailyRate)})`));
  }
  lines.push('');
  lines.push('※ 가상 브랜드 기반의 스타일링 예시이며, 실제 거래는 발생하지 않는 데모입니다.');
  return lines.join('\n');
}

// ---------- (3) 정품 인증·안전 거래 안내 생성 ----------
function mockAuthenticity(payload) {
  const it = payload.item || null;
  const lines = [];
  lines.push('정품 인증 · 안전 거래 안내 (데모 · 목업 응답)');
  lines.push('');
  if (it) {
    const verified = it.authenticity && it.authenticity.status === 'verified';
    lines.push(`대상: ${it.brand} · ${it.name} — 현재 상태: ${verified ? '정품 인증 완료(데모)' : '인증 대기'}`);
    if (verified && it.authenticity.code) lines.push(`인증 코드 ${it.authenticity.code} · ${it.authenticity.authenticator || '인증 랩(모의)'} · ${it.authenticity.checkedDate || ''}`.trim());
    lines.push('');
  }
  lines.push('LuxeLoop는 신뢰를 최우선으로, 아래 흐름으로 안전 거래를 설계했어요:');
  lines.push('');
  lines.push('1) 정품 인증 접수 — 소유자가 등록하면 전문 인증사(데모: 모의)가 로고·각인·소재·시리얼을 검수합니다.');
  lines.push('2) 인증 배지 발급 — 통과 시 인증 코드와 배지를 발급해 대여자가 신뢰도를 즉시 확인합니다.');
  lines.push('3) 보증금 에스크로 — 대여자의 환급성 보증금을 결제 시 예치(데모)하고 정상 반납 시 환급합니다.');
  lines.push('4) 선택형 손상·분실 보험 — 일일 보험료로 사고를 커버(데모)하며 자기부담금이 적용됩니다.');
  lines.push('5) 반납 검수 & 체크리스트 — 사진·상태를 상호 확인해 분쟁을 예방하고 보증금을 정산합니다.');
  lines.push('6) 양방향 리뷰 — 대여자·소유자가 서로 평가해 커뮤니티 신뢰를 축적합니다.');
  lines.push('');
  lines.push('안전 거래 팁:');
  lines.push('• 예약 전 정품 인증 배지와 인증 코드를 반드시 확인하세요.');
  lines.push('• 고가 아이템은 손상·분실 보험 가입을 권장합니다.');
  lines.push('• 수령/반납 시 체크리스트대로 사진을 남겨두면 분쟁을 예방할 수 있어요.');
  lines.push('');
  lines.push('⚠ 중요: 실제 정품 판별에는 반드시 전문 감정이 필요합니다. 이 안내와 배지는 워크플로우 시뮬레이션(데모)이며, 실제 인증·에스크로·보험·결제가 이뤄지지 않습니다.');
  return lines.join('\n');
}
