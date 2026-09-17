// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// app.js — 명품 공유 P2P 플랫폼 SPA 컨트롤러 (데모 모드)
// 해시 라우터 + 뷰 렌더링. 실제 결제/인증/DB 없음 — 로컬 시뮬레이션.

import { computeQuote, formatKRW, rentalDays } from './pricing.js';
import * as store from './storage.js';
import { itemSVG } from './svg.js';
import { askAI, isMock } from './ai/ai.js';

const state = {
  config: null,
  seedItems: [],
  items: [], // seed + user listings
  filters: { q: '', category: 'all', brand: 'all', maxRate: null, size: 'all', sort: 'recommended' },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = () => $('#app');

// ---------- data loading ----------
async function loadData() {
  const [cfg, itemsData] = await Promise.all([
    fetch('./data/config.json').then((r) => r.json()),
    fetch('./data/items.json').then((r) => r.json()),
  ]);
  state.config = cfg;
  state.seedItems = itemsData.items;
  refreshItems();
}

function refreshItems() {
  const listings = store.read(store.KEYS.listings, []);
  state.items = [...state.seedItems, ...listings];
}

function findItem(id) {
  refreshItems();
  return state.items.find((i) => i.id === id);
}

// ---------- reviews ----------
function itemReviews(item) {
  const user = store.read(store.KEYS.reviews, {})[item.id] || [];
  return [...(item.seededReviews || []), ...user];
}

// ---------- shared UI ----------
function badge(item) {
  const v = item.authenticity && item.authenticity.status === 'verified';
  return el('span', { class: 'badge ' + (v ? 'badge-verified' : 'badge-pending') },
    v ? '정품 인증' : '인증 대기');
}

function stars(rating) {
  const r = Math.round((Number(rating) || 0) * 2) / 2;
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return '★'.repeat(full) + (half ? '⯪' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
}

function wishBtn(item) {
  const wl = store.read(store.KEYS.wishlist, []);
  const on = wl.includes(item.id);
  return el('button', {
    class: 'wish' + (on ? ' on' : ''),
    'aria-label': '위시리스트 토글',
    title: '위시리스트',
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.toggleInArray(store.KEYS.wishlist, item.id);
      e.currentTarget.classList.toggle('on');
    },
  }, on ? '♥' : '♡');
}

function itemCard(item) {
  const card = el('a', { class: 'card', href: `#/item/${item.id}` });
  const media = el('div', { class: 'card-media', html: itemSVG(item.category, item.color, item.brand) });
  media.append(badge(item), wishBtn(item));
  card.append(
    media,
    el('div', { class: 'card-body' },
      el('div', { class: 'card-brand' }, item.brand),
      el('div', { class: 'card-name' }, item.name.replace(item.brand, '').trim() || item.categoryKo),
      el('div', { class: 'card-meta' },
        el('span', {}, `${item.categoryKo} · ${item.size}`),
        el('span', { class: 'grade' }, `${item.condition}등급`)),
      el('div', { class: 'card-price' },
        el('strong', {}, formatKRW(item.dailyRate)), el('span', { class: 'per' }, ' /일')),
      el('div', { class: 'card-sub' }, `보증금 ${formatKRW(item.deposit)} · ${stars(item.rating)} ${item.rating}`)
    )
  );
  return card;
}

// ---------- header ----------
function renderChrome() {
  const wl = store.read(store.KEYS.wishlist, []).length;
  const bk = store.read(store.KEYS.bookings, []).length;
  const header = el('header', { class: 'topbar' },
    el('a', { class: 'brand', href: '#/' },
      el('span', { class: 'brand-mark', html: '◈' }), el('span', {}, 'Luxe'), el('em', {}, 'Loop')),
    el('nav', { class: 'nav' },
      el('a', { href: '#/browse' }, '탐색'),
      el('a', { href: '#/assistant' }, 'AI 상담'),
      el('a', { href: '#/protection' }, '안전장치'),
      el('a', { href: '#/list' }, '내 물건 등록'),
      el('a', { href: '#/wishlist' }, `위시리스트${wl ? ` (${wl})` : ''}`),
      el('a', { href: '#/bookings' }, `내 예약${bk ? ` (${bk})` : ''}`)),
    el('button', { class: 'theme-toggle', 'aria-label': '테마 전환', onclick: toggleTheme }, '◐'));
  return header;
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('lrp2p:theme', next); } catch {}
}

function footer() {
  return el('footer', { class: 'footer' },
    el('p', {},
      el('strong', {}, '데모 모드 안내: '),
      '모든 브랜드는 가상이며 실존 상표와 무관합니다. 정품 인증·에스크로·보험·결제는 시뮬레이션이며 실제 거래가 발생하지 않습니다. 데이터는 브라우저 localStorage에만 저장됩니다.'),
    el('p', { class: 'muted' }, 'Not an official Anthropic product. © 2026 CLSOFTLAB · Apache-2.0'),
    el('button', { class: 'linkbtn', onclick: () => {
      if (confirm('데모 데이터(등록 물건·예약·위시리스트·리뷰)를 모두 초기화할까요?')) {
        store.resetAll();
        location.hash = '#/';
        route();
      }
    } }, '데모 데이터 초기화'));
}

// ---------- views ----------
function viewHome() {
  refreshItems();
  const featured = [...state.items].sort((a, b) => b.rating - a.rating).slice(0, 8);
  const c = el('div', {});
  c.append(
    el('section', { class: 'hero' },
      el('div', { class: 'hero-inner' },
        el('p', { class: 'eyebrow' }, '명품 공유 P2P · 신뢰가 먼저입니다'),
        el('h1', {}, '가지고 있는 명품을 빌려주고,', el('br', {}), '원하는 명품을 안전하게 빌리세요.'),
        el('p', { class: 'lede' }, '정품 인증 배지, 보증금 에스크로, 손상·분실 보험까지 — 안전장치를 기본으로 설계한 데모 플랫폼입니다.'),
        el('div', { class: 'hero-cta' },
          el('a', { class: 'btn btn-primary', href: '#/browse' }, '아이템 탐색'),
          el('a', { class: 'btn btn-ghost', href: '#/protection' }, '안전장치 살펴보기')),
        el('div', { class: 'hero-stats' },
          statTile(state.seedItems.length + '+', '등록 아이템'),
          statTile(state.seedItems.filter((i) => i.authenticity.status === 'verified').length + '', '정품 인증 완료'),
          statTile('4개', '카테고리')))),
    el('section', { class: 'wrap' },
      el('div', { class: 'cat-grid' }, ...state.config.categories.map((cat) =>
        el('a', { class: 'cat-tile', href: `#/browse?category=${cat.key}` },
          el('span', { class: 'cat-emoji', html: itemSVG(cat.key, '#8a7f8f') }),
          el('span', {}, cat.ko)))),
    ),
    weeklyDigest(),
    el('section', { class: 'wrap' },
      el('div', { class: 'section-head' }, el('h2', {}, '추천 아이템'), el('a', { href: '#/browse' }, '전체 보기 →')),
      el('div', { class: 'grid' }, ...featured.map(itemCard)))
  );
  return c;
}

// ---------- 무인(autonomous) 위클리 다이제스트 ----------
// 홈 진입 시 자동으로 "이번 주 추천 대여 아이템 (상황/예산 기반)"을 생성합니다.
// 카탈로그 + pricing 엔진 + askAI 를 재사용하므로, 오프라인 목업에서도 항상 동작합니다.
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
}

function weeklyPick() {
  const opts = [
    { key: 'wedding', ko: '결혼식/하객', budget: 120000, message: '이번 주 결혼식 하객룩에 어울리는 아이템을 예산 안에서 추천해줘' },
    { key: 'party', ko: '파티/행사', budget: 150000, message: '이번 주 파티·연말 행사에 어울리는 아이템을 예산 안에서 추천해줘' },
    { key: 'date', ko: '데이트/기념일', budget: 90000, message: '이번 주 데이트·기념일에 어울리는 아이템을 예산 안에서 추천해줘' },
    { key: 'travel', ko: '여행/휴가', budget: 100000, message: '이번 주 여행·휴가에 어울리는 아이템을 예산 안에서 추천해줘' },
    { key: 'business', ko: '비즈니스/면접', budget: 110000, message: '이번 주 비즈니스 미팅·면접에 어울리는 아이템을 예산 안에서 추천해줘' },
  ];
  return opts[isoWeek(new Date()) % opts.length];
}

function weeklyDigest() {
  const pick = weeklyPick();
  const out = el('div', { class: 'ai-out-holder', 'aria-live': 'polite', 'aria-label': '이번 주 추천 대여 아이템' });
  const sec = el('section', { class: 'wrap' },
    el('section', { class: 'panel ai-panel auto-digest' },
      el('div', { class: 'section-head' },
        el('h2', {}, '이번 주 추천 대여 아이템'),
        el('span', { class: 'badge badge-verified' }, isMock() ? '자동 · 데모(목업)' : '자동 · Claude')),
      el('p', { class: 'muted' }, `상황 “${pick.ko}” · 일일 예산 ${formatKRW(pick.budget)} 이하 기준으로 매주 자동 큐레이션됩니다.`),
      out,
      aiModeNote()));
  // 무인 자동 생성 (목업이면 오프라인에서도 동작, 실 연동 실패 시 자동 폴백)
  runAI('chat', { message: pick.message, budget: pick.budget, items: state.items, pricing: state.config.pricing }, out, null);
  return sec;
}

function statTile(n, label) {
  return el('div', { class: 'stat' }, el('div', { class: 'stat-n' }, n), el('div', { class: 'stat-l' }, label));
}

function parseQuery(hash) {
  const qi = hash.indexOf('?');
  const out = {};
  if (qi >= 0) for (const [k, v] of new URLSearchParams(hash.slice(qi + 1))) out[k] = v;
  return out;
}

function viewBrowse(query) {
  refreshItems();
  if (query.category) state.filters.category = query.category;
  const f = state.filters;
  const brands = [...new Set(state.items.map((i) => i.brand))].sort();
  const sizes = [...new Set(state.items.filter((i) => f.category === 'all' || i.category === f.category).map((i) => i.size))];

  const wrap = el('div', { class: 'wrap browse' });
  const results = el('div', { class: 'grid' });

  function apply() {
    let list = state.items.slice();
    if (f.category !== 'all') list = list.filter((i) => i.category === f.category);
    if (f.brand !== 'all') list = list.filter((i) => i.brand === f.brand);
    if (f.size !== 'all') list = list.filter((i) => i.size === f.size);
    if (f.maxRate) list = list.filter((i) => i.dailyRate <= f.maxRate);
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((i) => (i.name + ' ' + i.brand + ' ' + i.categoryKo + ' ' + (i.tags || []).join(' ')).toLowerCase().includes(q));
    }
    const sorters = {
      recommended: (a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount,
      priceAsc: (a, b) => a.dailyRate - b.dailyRate,
      priceDesc: (a, b) => b.dailyRate - a.dailyRate,
      rating: (a, b) => b.rating - a.rating,
    };
    list.sort(sorters[f.sort] || sorters.recommended);
    results.innerHTML = '';
    $('#result-count').textContent = `${list.length}개 아이템`;
    if (!list.length) results.append(el('p', { class: 'empty' }, '조건에 맞는 아이템이 없습니다.'));
    else list.forEach((i) => results.append(itemCard(i)));
  }

  const catSel = el('select', { onchange: (e) => { f.category = e.target.value; f.size = 'all'; apply(); rebuildSizes(); } },
    el('option', { value: 'all' }, '전체 카테고리'),
    ...state.config.categories.map((c) => el('option', { value: c.key, selected: f.category === c.key ? '' : null }, c.ko)));
  const brandSel = el('select', { onchange: (e) => { f.brand = e.target.value; apply(); } },
    el('option', { value: 'all' }, '전체 브랜드'), ...brands.map((b) => el('option', { value: b }, b)));
  const sizeSel = el('select', { onchange: (e) => { f.size = e.target.value; apply(); } });
  function rebuildSizes() {
    const sz = [...new Set(state.items.filter((i) => f.category === 'all' || i.category === f.category).map((i) => i.size))];
    sizeSel.innerHTML = '';
    sizeSel.append(el('option', { value: 'all' }, '전체 사이즈'), ...sz.map((s) => el('option', { value: s }, s)));
  }
  rebuildSizes();
  const rateInput = el('input', { type: 'number', min: '0', step: '10000', placeholder: '일일요금 상한(₩)',
    oninput: (e) => { f.maxRate = e.target.value ? Number(e.target.value) : null; apply(); } });
  const search = el('input', { type: 'search', placeholder: '브랜드·이름·태그 검색', value: f.q,
    oninput: (e) => { f.q = e.target.value; apply(); } });
  const sortSel = el('select', { onchange: (e) => { f.sort = e.target.value; apply(); } },
    el('option', { value: 'recommended' }, '추천순'),
    el('option', { value: 'priceAsc' }, '요금 낮은순'),
    el('option', { value: 'priceDesc' }, '요금 높은순'),
    el('option', { value: 'rating' }, '평점순'));

  wrap.append(
    el('div', { class: 'browse-head' }, el('h1', {}, '아이템 탐색'), el('span', { id: 'result-count', class: 'muted' })),
    el('div', { class: 'filters' }, search, catSel, brandSel, sizeSel, rateInput, sortSel),
    results
  );
  apply();
  return wrap;
}

function calendar(item, selectStart, selectEnd, onPick) {
  const unavailable = new Set(item.unavailableDates || []);
  const grid = el('div', { class: 'cal' });
  const base = new Date('2026-10-01T00:00:00Z');
  const monthLabel = el('div', { class: 'cal-month' }, '2026년 10월 예약 가능일');
  const days = el('div', { class: 'cal-grid' });
  ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => days.append(el('div', { class: 'cal-dow' }, d)));
  const firstDow = base.getUTCDay();
  for (let i = 0; i < firstDow; i++) days.append(el('div', {}));
  for (let d = 1; d <= 31; d++) {
    const iso = `2026-10-${String(d).padStart(2, '0')}`;
    const isOut = unavailable.has(iso);
    const inRange = selectStart && selectEnd && iso >= selectStart && iso <= selectEnd;
    const isEnd = iso === selectStart || iso === selectEnd;
    const cell = el('button', {
      class: 'cal-day' + (isOut ? ' out' : '') + (inRange ? ' range' : '') + (isEnd ? ' sel' : ''),
      disabled: isOut ? '' : null,
      onclick: () => onPick(iso),
    }, String(d));
    days.append(cell);
  }
  grid.append(monthLabel, days,
    el('div', { class: 'cal-legend' },
      el('span', {}, el('i', { class: 'dot' }), ' 선택'),
      el('span', {}, el('i', { class: 'dot out' }), ' 예약불가')));
  return grid;
}

function viewItem(id) {
  const item = findItem(id);
  if (!item) return el('div', { class: 'wrap' }, el('p', { class: 'empty' }, '아이템을 찾을 수 없습니다.'));
  const reviews = itemReviews(item);
  const wrap = el('div', { class: 'wrap detail' });
  const gallery = el('div', { class: 'detail-media', html: itemSVG(item.category, item.color, item.brand) });
  gallery.append(badge(item));

  const info = el('div', { class: 'detail-info' });
  info.append(
    el('p', { class: 'eyebrow' }, `${item.categoryKo} · ${item.location}`),
    el('h1', {}, item.name),
    el('div', { class: 'detail-rating' }, `${stars(item.rating)} ${item.rating} · 리뷰 ${reviews.length}건`),
    el('div', { class: 'price-row' },
      el('div', {}, el('span', { class: 'muted' }, '일일 요금'), el('div', { class: 'big' }, formatKRW(item.dailyRate))),
      el('div', {}, el('span', { class: 'muted' }, '보증금'), el('div', { class: 'big' }, formatKRW(item.deposit))),
      el('div', {}, el('span', { class: 'muted' }, '정가(참고)'), el('div', { class: 'big muted' }, formatKRW(item.retailValue)))),
    el('div', { class: 'chips' },
      el('span', { class: 'chip' }, `상태 ${item.condition}등급`),
      el('span', { class: 'chip' }, item.size),
      ...(item.insuranceEligible ? [el('span', { class: 'chip chip-ok' }, '보험 가입 가능')] : [])),
    el('p', { class: 'desc' }, item.description),
    authBox(item),
    el('div', { class: 'owner' },
      el('div', { class: 'owner-av' }, (item.owner.name || '?').slice(0, 1)),
      el('div', {},
        el('strong', {}, item.owner.name),
        el('div', { class: 'muted' }, `소유자 평점 ${stars(item.owner.rating)} ${item.owner.rating} · 리뷰 ${item.owner.reviews}`))),
    el('div', { class: 'detail-actions' },
      el('a', { class: 'btn btn-primary', href: `#/book/${item.id}` }, '이 날짜로 예약하기'),
      wishBtnWide(item))
  );

  wrap.append(
    el('a', { class: 'back', href: '#/browse' }, '← 탐색으로'),
    el('div', { class: 'detail-top' }, gallery, info),
    el('section', { class: 'panel' }, el('h2', {}, '대여 가능 날짜'),
      calendar(item, null, null, () => { location.hash = `#/book/${item.id}`; })),
    aiStylingPanel(item),
    reviewsSection(item)
  );
  return wrap;
}

function authBox(item) {
  const v = item.authenticity && item.authenticity.status === 'verified';
  const box = el('div', { class: 'authbox ' + (v ? 'ok' : 'pending') });
  if (v) {
    box.append(
      el('div', { class: 'authbox-head' }, '✓ 정품 인증 완료 (데모)'),
      el('div', { class: 'muted' }, `${item.authenticity.authenticator} · 인증코드 ${item.authenticity.code} · ${item.authenticity.checkedDate}`),
      el('p', { class: 'fine' }, '데모 안내: 실제 정품 판별은 전문 감정이 필요합니다. 본 배지는 워크플로우 시뮬레이션입니다.'));
  } else {
    box.append(
      el('div', { class: 'authbox-head' }, '⧗ 정품 인증 대기 중'),
      el('p', { class: 'fine' }, '이 아이템은 아직 인증 검수 전입니다. 예약 시 인증 완료 후 발송을 권장합니다.'));
  }
  box.append(el('a', { class: 'linkbtn', href: '#/protection' }, '안전장치 흐름 보기 →'));
  return box;
}

function wishBtnWide(item) {
  const wl = store.read(store.KEYS.wishlist, []);
  const on = wl.includes(item.id);
  const b = el('button', { class: 'btn btn-ghost' }, on ? '♥ 위시리스트에 있음' : '♡ 위시리스트 담기');
  b.addEventListener('click', () => {
    store.toggleInArray(store.KEYS.wishlist, item.id);
    const now = store.read(store.KEYS.wishlist, []).includes(item.id);
    b.textContent = now ? '♥ 위시리스트에 있음' : '♡ 위시리스트 담기';
  });
  return b;
}

function reviewsSection(item) {
  const sec = el('section', { class: 'panel' });
  const list = el('div', { class: 'reviews' });
  function render() {
    list.innerHTML = '';
    const rv = itemReviews(item);
    if (!rv.length) list.append(el('p', { class: 'muted' }, '아직 리뷰가 없습니다. 첫 리뷰를 남겨보세요.'));
    rv.forEach((r) => list.append(el('div', { class: 'review' },
      el('div', { class: 'review-head' },
        el('strong', {}, r.by), el('span', { class: 'role' }, r.role === 'owner' ? '소유자' : '대여자'),
        el('span', { class: 'rstars' }, stars(r.rating))),
      el('p', {}, r.text))));
  }
  render();

  const nameI = el('input', { placeholder: '이름(닉네임)', maxlength: '20' });
  const roleS = el('select', {}, el('option', { value: 'renter' }, '대여자로 작성'), el('option', { value: 'owner' }, '소유자로 작성'));
  const rateS = el('select', {}, ...[5, 4, 3, 2, 1].map((n) => el('option', { value: n }, `${n}점 ${stars(n)}`)));
  const textI = el('textarea', { placeholder: '거래 경험을 남겨주세요 (양방향 리뷰)', maxlength: '300' });
  const form = el('form', { class: 'review-form', onsubmit: (e) => {
    e.preventDefault();
    if (!nameI.value.trim() || !textI.value.trim()) return;
    const all = store.read(store.KEYS.reviews, {});
    (all[item.id] = all[item.id] || []).push({
      by: nameI.value.trim(), role: roleS.value, rating: Number(rateS.value), text: textI.value.trim(),
    });
    store.write(store.KEYS.reviews, all);
    nameI.value = ''; textI.value = '';
    render();
  } },
    el('h3', {}, '리뷰 작성 (양방향)'),
    el('div', { class: 'form-row' }, nameI, roleS, rateS),
    textI,
    el('button', { class: 'btn btn-primary', type: 'submit' }, '리뷰 등록'));

  sec.append(el('h2', {}, `리뷰 (${itemReviews(item).length})`), list, form);
  return sec;
}

function viewBook(id) {
  const item = findItem(id);
  if (!item) return el('div', { class: 'wrap' }, el('p', { class: 'empty' }, '아이템을 찾을 수 없습니다.'));
  const sel = { start: null, end: null, insurance: item.insuranceEligible };
  const wrap = el('div', { class: 'wrap book' });
  const summary = el('div', { class: 'book-summary' });

  function pick(iso) {
    if (!sel.start || (sel.start && sel.end)) { sel.start = iso; sel.end = null; }
    else if (iso < sel.start) { sel.end = sel.start; sel.start = iso; }
    else sel.end = iso;
    // 예약불가일이 구간에 포함되면 무효 처리
    if (sel.start && sel.end) {
      const un = new Set(item.unavailableDates || []);
      for (let d = new Date(sel.start + 'T00:00:00Z'); d <= new Date(sel.end + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
        if (un.has(d.toISOString().slice(0, 10))) { alert('선택 구간에 예약 불가일이 포함되어 있습니다.'); sel.end = null; break; }
      }
    }
    renderCal();
    renderSummary();
  }
  const calHolder = el('div', {});
  function renderCal() { calHolder.innerHTML = ''; calHolder.append(calendar(item, sel.start, sel.end, pick)); }
  renderCal();

  const insToggle = el('label', { class: 'switch' },
    el('input', { type: 'checkbox', checked: sel.insurance ? '' : null, disabled: item.insuranceEligible ? null : '',
      onchange: (e) => { sel.insurance = e.target.checked; renderSummary(); } }),
    el('span', {}, item.insuranceEligible ? '손상·분실 보험 추가 (일일 보험료)' : '이 아이템은 보험 미지원'));

  function renderSummary() {
    const q = computeQuote({ dailyRate: item.dailyRate, deposit: item.deposit, retailValue: item.retailValue, start: sel.start, end: sel.end, insurance: sel.insurance }, state.config.pricing);
    summary.innerHTML = '';
    const rows = [];
    if (!q.valid) {
      summary.append(el('p', { class: 'muted' }, '캘린더에서 시작일과 반납일을 선택하세요.'));
      payBtn.disabled = true;
      return;
    }
    payBtn.disabled = false;
    rows.push(['대여 기간', `${sel.start} ~ ${sel.end} (${q.days}일)`]);
    rows.push([`대여요금 (${formatKRW(item.dailyRate)} × ${q.days}일)`, formatKRW(q.baseFee)]);
    if (q.discountAmount > 0) rows.push([`기간 할인 (-${Math.round(q.discountRate * 100)}%)`, '- ' + formatKRW(q.discountAmount)]);
    rows.push([`서비스 수수료 (${Math.round(state.config.pricing.serviceFeeRate * 100)}%)`, formatKRW(q.serviceFee)]);
    if (q.insurance > 0) rows.push(['손상·분실 보험(모의)', formatKRW(q.insurance)]);
    rows.push(['보증금 (반납 시 환급)', formatKRW(q.deposit)]);
    rows.forEach(([k, v]) => summary.append(el('div', { class: 'sum-row' }, el('span', {}, k), el('span', {}, v))));
    summary.append(el('div', { class: 'sum-row total' }, el('span', {}, '결제 예정 금액'), el('strong', {}, formatKRW(q.dueNow))));
    summary.append(el('p', { class: 'fine' }, `대여요금 합계 ${formatKRW(q.rentalTotal)} + 보증금 ${formatKRW(q.deposit)}. 보증금은 정상 반납 시 전액 환급(데모).`));
  }

  const payBtn = el('button', { class: 'btn btn-primary btn-lg', disabled: '', onclick: () => {
    const q = computeQuote({ dailyRate: item.dailyRate, deposit: item.deposit, retailValue: item.retailValue, start: sel.start, end: sel.end, insurance: sel.insurance }, state.config.pricing);
    if (!q.valid) return;
    const booking = {
      id: 'BK-' + Date.now().toString(36).toUpperCase(),
      itemId: item.id, itemName: item.name, brand: item.brand, color: item.color, category: item.category,
      start: sel.start, end: sel.end, days: q.days, insurance: sel.insurance,
      rentalTotal: q.rentalTotal, deposit: q.deposit, dueNow: q.dueNow,
      createdAt: new Date().toISOString(), status: 'confirmed',
    };
    store.push(store.KEYS.bookings, booking);
    location.hash = '#/bookings?new=' + booking.id;
  } }, '모의 결제하고 예약 확정');

  renderSummary();
  wrap.append(
    el('a', { class: 'back', href: `#/item/${item.id}` }, '← 아이템으로'),
    el('h1', {}, '대여 예약'),
    el('div', { class: 'book-grid' },
      el('div', { class: 'panel' },
        el('h2', {}, item.name), badge(item),
        el('p', { class: 'muted' }, '① 날짜 선택 → ② 옵션 → ③ 모의 결제'),
        calHolder,
        el('div', { class: 'book-opts' }, insToggle)),
      el('div', { class: 'panel sticky' },
        el('h2', {}, '요금 계산'), summary,
        el('div', { class: 'pay-note' }, '🔒 데모 결제: 카드·계좌 정보를 입력받지 않으며 실제 청구가 발생하지 않습니다.'),
        payBtn))
  );
  return wrap;
}

function viewBookings(query) {
  const bookings = store.read(store.KEYS.bookings, []).slice().reverse();
  const wrap = el('div', { class: 'wrap' });
  wrap.append(el('h1', {}, '내 예약'));
  if (query.new) wrap.append(el('div', { class: 'toast' }, `✓ 예약이 확정되었습니다 (${query.new}). 반납 체크리스트를 확인하세요.`));
  if (!bookings.length) { wrap.append(el('p', { class: 'empty' }, '아직 예약이 없습니다.'), el('a', { class: 'btn btn-primary', href: '#/browse' }, '아이템 탐색')); return wrap; }
  const list = el('div', { class: 'booking-list' });
  bookings.forEach((b) => {
    const card = el('div', { class: 'booking' });
    card.append(
      el('div', { class: 'booking-media', html: itemSVG(b.category, b.color, b.brand) }),
      el('div', { class: 'booking-body' },
        el('strong', {}, b.itemName),
        el('div', { class: 'muted' }, `${b.start} ~ ${b.end} · ${b.days}일 · ${b.insurance ? '보험 포함' : '보험 없음'}`),
        el('div', {}, `결제 ${formatKRW(b.dueNow)} (대여 ${formatKRW(b.rentalTotal)} + 보증금 ${formatKRW(b.deposit)})`),
        el('span', { class: 'status ' + b.status }, b.status === 'returned' ? '반납 완료' : '예약 확정')),
      el('div', { class: 'booking-actions' },
        checklistBtn(b),
        el('button', { class: 'linkbtn danger', onclick: () => {
          if (!confirm('이 예약을 취소할까요? (데모)')) return;
          const all = store.read(store.KEYS.bookings, []).filter((x) => x.id !== b.id);
          store.write(store.KEYS.bookings, all);
          route();
        } }, '취소')));
    list.append(card);
  });
  wrap.append(list);
  return wrap;
}

function checklistBtn(b) {
  const btn = el('button', { class: 'btn btn-ghost btn-sm' }, b.status === 'returned' ? '체크리스트 보기' : '반납 체크리스트');
  btn.addEventListener('click', () => openChecklist(b));
  return btn;
}

function openChecklist(b) {
  const items = state.config.returnChecklist;
  const done = new Set();
  const modal = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === modal) modal.remove(); } });
  const finBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: () => {
    const all = store.read(store.KEYS.bookings, []);
    const t = all.find((x) => x.id === b.id);
    if (t) { t.status = 'returned'; store.write(store.KEYS.bookings, all); }
    modal.remove();
    route();
  } }, '반납 완료 & 보증금 환급 요청(모의)');
  const box = el('div', { class: 'modal' },
    el('h2', {}, '반납 검수 체크리스트'),
    el('p', { class: 'muted' }, `${b.itemName} · ${b.start} ~ ${b.end}`),
    ...items.map((t, i) => el('label', { class: 'check' },
      el('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? done.add(i) : done.delete(i); finBtn.disabled = done.size !== items.length; } }),
      el('span', {}, t))),
    el('p', { class: 'fine' }, '모든 항목 확인 시 반납 완료 및 보증금 환급이 시뮬레이션됩니다.'),
    el('div', { class: 'modal-actions' }, el('button', { class: 'btn btn-ghost', onclick: () => modal.remove() }, '닫기'), finBtn));
  modal.append(box);
  document.body.append(modal);
}

function viewList() {
  const wrap = el('div', { class: 'wrap' });
  const f = {};
  const input = (name, label, attrs = {}) => {
    const i = el('input', { name, ...attrs });
    return el('label', { class: 'field' }, el('span', {}, label), i);
  };
  const catSel = el('select', { name: 'category', required: '' },
    ...state.config.categories.map((c) => el('option', { value: c.key }, c.ko)));
  const condSel = el('select', { name: 'condition' }, ...['S', 'A', 'B'].map((g) => el('option', { value: g }, `${g}등급`)));

  const form = el('form', { class: 'listform', onsubmit: (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const g = (k) => (fd.get(k) || '').toString().trim();
    const cat = g('category');
    const catKo = state.config.categories.find((c) => c.key === cat).ko;
    const colors = { bag: '#7c5c3e', watch: '#2b3a4a', jewelry: '#8a6d9e', clothing: '#3a4a3f' };
    const wantAuth = fd.get('reqauth') === 'on';
    const listing = {
      id: 'LR-U' + Date.now().toString(36).toUpperCase(),
      name: `${g('brand')} ${g('model')}`.trim(),
      brand: g('brand') || '미상 브랜드',
      category: cat, categoryKo: catKo, size: g('size') || '프리사이즈',
      condition: g('condition'), conditionLabel: `${g('condition')}등급`,
      dailyRate: Number(fd.get('dailyRate')) || 0,
      deposit: Number(fd.get('deposit')) || 0,
      retailValue: Number(fd.get('retailValue')) || 0,
      authenticity: wantAuth
        ? { status: 'pending', authenticator: null, checkedDate: null, code: null }
        : { status: 'pending', authenticator: null, checkedDate: null, code: null },
      insuranceEligible: fd.get('insurance') === 'on',
      color: colors[cat] || '#6b5b73',
      owner: { name: g('owner') || '나', rating: 5.0, reviews: 0 },
      rating: 0, reviewsCount: 0, location: g('location') || '위치 미정',
      description: g('desc') || '소유자가 등록한 아이템입니다.',
      tags: [catKo, g('brand'), `${g('condition')}등급`, '인증대기'],
      unavailableDates: [], seededReviews: [], userListed: true,
    };
    store.push(store.KEYS.listings, listing);
    refreshItems();
    alert('등록되었습니다! 정품 인증 검수(모의) 후 배지가 발급됩니다.');
    location.hash = `#/item/${listing.id}`;
  } },
    el('div', { class: 'form-grid' },
      el('label', { class: 'field' }, el('span', {}, '카테고리'), catSel),
      input('brand', '브랜드(가상)', { required: '', placeholder: '예: Aureléon' }),
      input('model', '모델/이름', { placeholder: '예: 토트백' }),
      input('size', '사이즈', { placeholder: '예: 미디엄 / 40mm / M' }),
      el('label', { class: 'field' }, el('span', {}, '상태 등급'), condSel),
      input('dailyRate', '일일 요금 (₩)', { type: 'number', min: '0', step: '1000', required: '' }),
      input('deposit', '보증금 (₩)', { type: 'number', min: '0', step: '10000', required: '' }),
      input('retailValue', '정가/추정가치 (₩)', { type: 'number', min: '0', step: '10000' }),
      input('location', '거래 지역', { placeholder: '예: 서울 강남' }),
      input('owner', '표시 이름', { placeholder: '닉네임' })),
    el('label', { class: 'field' }, el('span', {}, '설명'), el('textarea', { name: 'desc', maxlength: '400', placeholder: '아이템 상태, 부속품, 특이사항' })),
    el('div', { class: 'form-checks' },
      el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'reqauth', checked: '' }), el('span', {}, '정품 인증 검수 요청(모의)')),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'insurance', checked: '' }), el('span', {}, '손상·분실 보험 가입 허용'))),
    el('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, '대여 놓기'));

  wrap.append(
    el('h1', {}, '내 물건 등록 (대여 놓기)'),
    el('p', { class: 'muted' }, '유휴 명품을 등록하면 정품 인증 검수(모의)를 거쳐 대여 목록에 노출됩니다. 등록 정보는 브라우저에만 저장됩니다.'),
    form,
    myListings());
  return wrap;
}

function myListings() {
  const mine = store.read(store.KEYS.listings, []).slice().reverse();
  if (!mine.length) return el('div', {});
  const sec = el('section', { class: 'panel' }, el('h2', {}, `내가 등록한 아이템 (${mine.length})`));
  const grid = el('div', { class: 'grid' });
  mine.forEach((i) => {
    const card = itemCard(i);
    grid.append(card);
  });
  sec.append(grid);
  return sec;
}

function viewProtection() {
  const wrap = el('div', { class: 'wrap' });
  wrap.append(
    el('div', { class: 'proto-hero' },
      el('h1', {}, '정품 인증 & 안전장치'),
      el('p', { class: 'lede' }, '명품 P2P의 핵심은 신뢰입니다. LuxeLoop는 정품 인증·보증금 에스크로·보험·반납 검수를 기본 흐름으로 설계했습니다.'),
      el('div', { class: 'warn' }, '⚠ 데모 안내: 실제 정품 판별에는 전문 감정이 필요합니다. 아래 흐름은 모의(시뮬레이션)이며 실제 인증·에스크로·보험·결제가 이뤄지지 않습니다.')),
    el('div', { class: 'steps' }, ...state.config.protectionSteps.map((s) =>
      el('div', { class: 'step' },
        el('div', { class: 'step-n' }, String(s.step)),
        el('div', {}, el('h3', {}, s.title), el('p', {}, s.desc))))),
    el('section', { class: 'panel' },
      el('h2', {}, '반납 검수 체크리스트'),
      el('ul', { class: 'checklist-static' }, ...state.config.returnChecklist.map((t) => el('li', {}, t)))),
    el('section', { class: 'panel proto-cards' },
      protoCard('정품 인증 배지', '로고·각인·소재·시리얼을 검수해 인증 코드를 발급합니다. 대여자는 배지로 신뢰도를 즉시 확인합니다.'),
      protoCard('보증금 에스크로', '대여자 보증금을 안전하게 예치하고 정상 반납 시 환급합니다. 분쟁 시 검수 결과에 따라 정산합니다.'),
      protoCard('손상·분실 보험', '선택형 일일 보험료로 예기치 못한 손상·분실을 커버합니다. 자기부담금이 적용됩니다.'),
      protoCard('양방향 리뷰', '대여자·소유자가 서로 평가해 커뮤니티 신뢰를 축적합니다. 반복 불량 사용자는 자연스럽게 걸러집니다.')),
    aiSafetyPanel());
  return wrap;
}

function protoCard(t, d) { return el('div', { class: 'pcard' }, el('h3', {}, t), el('p', {}, d)); }

function viewWishlist() {
  refreshItems();
  const wl = store.read(store.KEYS.wishlist, []);
  const items = wl.map((id) => state.items.find((i) => i.id === id)).filter(Boolean);
  const wrap = el('div', { class: 'wrap' });
  wrap.append(el('h1', {}, `위시리스트 (${items.length})`));
  if (!items.length) { wrap.append(el('p', { class: 'empty' }, '위시리스트가 비어 있습니다. 마음에 드는 아이템의 ♡를 눌러 담아보세요.'), el('a', { class: 'btn btn-primary', href: '#/browse' }, '아이템 탐색')); return wrap; }
  const grid = el('div', { class: 'grid' });
  items.forEach((i) => grid.append(itemCard(i)));
  wrap.append(grid);
  return wrap;
}

// ---------- AI 기능 ----------
// 스트리밍 응답을 target 요소에 흘려 렌더링하는 공통 헬퍼.
// btn 을 비활성화/복원하고, 오류를 안전하게 표시합니다.
async function runAI(task, payload, target, btn) {
  const prevLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '생성 중…'; }
  target.classList.add('ai-out');
  target.classList.remove('empty');
  target.textContent = '';
  const cursor = el('span', { class: 'ai-cursor' }, '▌');
  target.append(cursor);
  try {
    await askAI(task, payload, {
      onToken: (chunk) => { cursor.before(document.createTextNode(chunk)); },
    });
    cursor.remove();
  } catch (err) {
    cursor.remove();
    target.append(el('p', { class: 'ai-error' }, 'AI 응답을 가져오지 못했습니다: ' + (err && err.message || err)));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = prevLabel; }
  }
}

function aiModeNote() {
  return el('p', { class: 'fine ai-mode' },
    isMock()
      ? '현재 데모(목업) 모드입니다 — 실제 카탈로그·요금 엔진 기반의 결정론적 한국어 응답입니다. 실제 Claude 연동은 server/ 프록시 + AI_ENDPOINT 설정으로 활성화됩니다.'
      : '실제 Claude 연동 모드입니다 (백엔드 프록시 경유).');
}

// (1) 대여 상담 챗봇 뷰
function viewAssistant() {
  refreshItems();
  const wrap = el('div', { class: 'wrap assistant' });
  const log = el('div', { class: 'ai-chat-log' });

  function addUser(text) { log.append(el('div', { class: 'ai-msg user' }, el('div', { class: 'ai-bubble' }, text))); log.scrollTop = log.scrollHeight; }
  function addBot() {
    const body = el('div', { class: 'ai-bubble bot-bubble' });
    log.append(el('div', { class: 'ai-msg bot' }, body));
    log.scrollTop = log.scrollHeight;
    return body;
  }

  const input = el('input', { type: 'text', class: 'ai-input', placeholder: '예: 결혼식 하객룩, 일일 12만원 이하 주얼리 추천해줘', maxlength: '200' });
  const sendBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, '보내기');

  async function submit(message) {
    const msg = (message || '').trim();
    if (!msg) return;
    addUser(msg);
    input.value = '';
    const body = addBot();
    sendBtn.disabled = true;
    await runAI('chat', { message: msg, items: state.items, pricing: state.config.pricing }, body, null);
    sendBtn.disabled = false;
    log.scrollTop = log.scrollHeight;
  }

  const form = el('form', { class: 'ai-chat-form', onsubmit: (e) => { e.preventDefault(); submit(input.value); } }, input, sendBtn);

  const chips = el('div', { class: 'ai-chips' },
    ...[
      '결혼식 하객룩, 일일 12만원 이하 주얼리 추천해줘',
      '10월 1일~7일 여행에 어울리는 가방 추천',
      '비즈니스 미팅용 시계 추천해줘',
    ].map((q) => el('button', { class: 'chip chip-btn', type: 'button', onclick: () => submit(q) }, q)));

  // 첫 안내 메시지 (목업으로 즉시 렌더)
  const intro = addBot();
  runAI('chat', { message: '', items: state.items, pricing: state.config.pricing }, intro, null);

  wrap.append(
    el('div', { class: 'browse-head' }, el('h1', {}, 'AI 대여 상담'), el('span', { class: 'badge badge-verified' }, isMock() ? '데모(목업)' : 'Claude 연동')),
    el('p', { class: 'muted' }, '상황·예산·기간을 알려주시면 카탈로그에서 어울리는 아이템을 추천해 드려요.'),
    chips,
    el('section', { class: 'panel ai-panel' }, log, form),
    aiModeNote());
  return wrap;
}

// (2) 코디/스타일링 추천 패널 (아이템 상세에 삽입)
function aiStylingPanel(item) {
  const sec = el('section', { class: 'panel ai-panel' });
  const out = el('div', { class: 'ai-out-holder muted' }, 'AI 코디 추천을 생성하려면 아래 버튼을 눌러주세요.');
  const btn = el('button', { class: 'btn btn-ghost' }, '✨ AI 코디/스타일링 추천');
  btn.addEventListener('click', () => runAI('styling', { item, items: state.items }, out, btn));
  sec.append(el('h2', {}, 'AI 코디/스타일링 추천'), btn, out, aiModeNote());
  return sec;
}

// (3) 정품 인증·안전 거래 안내 생성 패널 (안전장치 페이지에 삽입)
function aiSafetyPanel() {
  const sec = el('section', { class: 'panel ai-panel' });
  const out = el('div', { class: 'ai-out-holder muted' }, 'AI로 정품 인증·안전 거래 안내문을 생성할 수 있어요.');
  const btn = el('button', { class: 'btn btn-primary' }, '🛡 AI 안전 거래 안내 생성');
  btn.addEventListener('click', () => runAI('authenticity', {}, out, btn));
  sec.append(el('h2', {}, 'AI 정품 인증·안전 거래 안내'), btn, out, aiModeNote());
  return sec;
}

// ---------- router ----------
function route() {
  const hash = location.hash || '#/';
  const path = hash.split('?')[0];
  const query = parseQuery(hash);
  refreshItems();
  let view;
  if (path === '#/' || path === '') view = viewHome();
  else if (path === '#/browse') view = viewBrowse(query);
  else if (path.startsWith('#/item/')) view = viewItem(decodeURIComponent(path.slice(7)));
  else if (path.startsWith('#/book/')) view = viewBook(decodeURIComponent(path.slice(7)));
  else if (path === '#/list') view = viewList();
  else if (path === '#/assistant') view = viewAssistant();
  else if (path === '#/protection') view = viewProtection();
  else if (path === '#/wishlist') view = viewWishlist();
  else if (path === '#/bookings') view = viewBookings(query);
  else view = el('div', { class: 'wrap' }, el('p', { class: 'empty' }, '페이지를 찾을 수 없습니다.'), el('a', { href: '#/' }, '홈으로'));

  const root = app();
  root.innerHTML = '';
  root.append(renderChrome(), el('main', {}, view), footer());
  window.scrollTo(0, 0);
  // active nav
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === path));
}

function init() {
  try {
    const t = localStorage.getItem('lrp2p:theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch {}
  loadData().then(() => {
    route();
    window.addEventListener('hashchange', route);
  }).catch((err) => {
    app().innerHTML = '<div class="wrap"><p class="empty">데이터를 불러오지 못했습니다. 로컬 서버(http)로 실행했는지 확인하세요.<br>' + esc(err.message) + '</p></div>';
  });
}

document.addEventListener('DOMContentLoaded', init);
