// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/worker.js — Cloudflare Workers 변형 (무인·무료 티어 배포용).
//
//   POST /api/ai  { task, payload }  →  Claude 응답 텍스트를 반환
//
// Node 프록시(index.mjs)와 동일한 task 라우팅 + 모델/캐싱/thinking 규칙을 사용하며,
// Anthropic REST API 를 직접 호출합니다. 서버를 관리할 필요가 없어(무료 티어) 항상 켜져 있습니다.
//
// ⚠ 보안: API 키는 Worker Secret(ANTHROPIC_API_KEY)에만 존재합니다.
//         브라우저/리포지토리에는 절대 키를 두지 마세요.
//   wrangler secret put ANTHROPIC_API_KEY
//
// 배포: server/README.md 의 "Cloudflare Workers 원클릭 배포" 참고.

const MODEL_DEFAULT = 'claude-haiku-4-5'; // 비용 우선 기본값 (env.AI_MODEL 로 상향 가능)

const SYSTEMS = {
  chat:
    '당신은 명품 공유 P2P 대여 플랫폼 "LuxeLoop"의 한국어 대여 상담 도우미입니다. ' +
    '사용자의 상황(occasion)·예산(budget)·대여 기간(dates)에 맞춰, 제공된 카탈로그(payload.items) 안에서만 아이템을 추천하세요. ' +
    '카탈로그에 없는 아이템이나 실존 명품 브랜드를 지어내지 마세요(모든 브랜드는 가상입니다). ' +
    '가격·보증금·기간 할인은 제공된 값을 근거로 설명하고, 데모이며 실제 거래가 없음을 알리세요.',
  styling:
    '당신은 한국어 패션 스타일리스트입니다. 제공된 아이템(payload.item)에 대한 코디/스타일링을 서술형으로 추천하세요. ' +
    '가상 브랜드만 언급하고 실존 상표는 만들지 마세요. 데모임을 밝히세요.',
  authenticity:
    '당신은 명품 P2P 안전 거래 안내 도우미입니다. 정품 인증·보증금 에스크로·손상/분실 보험·반납 검수 워크플로우를 한국어로 설명하세요. ' +
    '실제 정품 판별에는 전문 감정이 반드시 필요함을 분명히 강조하고, 본 플랫폼의 인증/에스크로/보험/결제가 시뮬레이션(데모)임을 알리세요.',
};

const MAX_TOKENS = { chat: 700, styling: 700, authenticity: 900 };

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.startsWith('/api/ai')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: cors({ 'Content-Type': 'application/json' }),
      });
    }

    let task; let payload;
    try {
      const body = await request.json();
      task = body.task;
      payload = body.payload || {};
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400, headers: cors({ 'Content-Type': 'application/json' }),
      });
    }

    const model = env.AI_MODEL || MODEL_DEFAULT;
    const systemText = SYSTEMS[task] || SYSTEMS.chat;
    // 프롬프트 캐싱: 안정적인 시스템 프롬프트를 ephemeral 캐시 블록으로 전송
    const system = [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }];

    const reqBody = {
      model,
      max_tokens: MAX_TOKENS[task] || 700,
      system,
      messages: [{
        role: 'user',
        content: `task=${task}\n\n다음 JSON 컨텍스트를 바탕으로 한국어로 답하세요:\n${JSON.stringify(payload)}`,
      }],
    };
    // Haiku 4.5 는 adaptive thinking/effort 미지원 → 보내지 않음 (400 방지)
    if (!model.startsWith('claude-haiku')) {
      reqBody.thinking = { type: 'adaptive' };
      reqBody.output_config = { effort: env.AI_EFFORT || 'low' };
    }

    try {
      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(reqBody),
      });

      if (!apiRes.ok) {
        const detail = await apiRes.text().catch(() => '');
        return new Response(JSON.stringify({ error: `Anthropic ${apiRes.status}`, detail }), {
          status: 502, headers: cors({ 'Content-Type': 'application/json' }),
        });
      }

      const data = await apiRes.json();
      const text = Array.isArray(data.content)
        ? data.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
        : '';
      return new Response(text, {
        status: 200, headers: cors({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }),
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err && err.message || err) }), {
        status: 500, headers: cors({ 'Content-Type': 'application/json' }),
      });
    }
  },
};
