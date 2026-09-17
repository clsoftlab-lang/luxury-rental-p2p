// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — 실제 Claude 호출 백엔드 프록시 (선택 사항).
//
//   POST /api/ai  { task, payload }  →  Claude 응답을 텍스트 스트림으로 반환
//
// ⚠ 보안: API 키(ANTHROPIC_API_KEY)는 오직 이 백엔드(서버 프로세스)에만 존재합니다.
//         브라우저/리포지토리에는 절대 키를 두지 마세요. 프론트엔드는 이 프록시만 호출합니다.
//
// 실행:
//   cd server && cp .env.example .env  # .env 에 ANTHROPIC_API_KEY 입력
//   npm install && npm start
// 그런 다음 ai/config.js 의 AI_ENDPOINT 를 "http://localhost:8787/api/ai" 로 설정하세요.

import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.PORT) || 8787;
const MODEL = 'claude-opus-5';
const ORIGIN = process.env.CORS_ORIGIN || '*';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// task 별 시스템 프롬프트 — 가상 브랜드만 사용, 실제 정품 감정 필요성 강조
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

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders,
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'POST' || !req.url.startsWith('/api/ai')) {
    return send(res, 404, JSON.stringify({ error: 'Not found' }), { 'Content-Type': 'application/json' });
  }

  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1_000_000) req.destroy(); });
  req.on('end', async () => {
    let task; let payload;
    try {
      const parsed = JSON.parse(raw || '{}');
      task = parsed.task;
      payload = parsed.payload || {};
    } catch {
      return send(res, 400, JSON.stringify({ error: 'Invalid JSON body' }), { 'Content-Type': 'application/json' });
    }
    const system = SYSTEMS[task] || SYSTEMS.chat;
    const messages = [{
      role: 'user',
      content: `task=${task}\n\n다음 JSON 컨텍스트를 바탕으로 한국어로 답하세요:\n${JSON.stringify(payload)}`,
    }];

    try {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': ORIGIN,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system,
        messages,
      });
      stream.on('text', (t) => res.write(t));
      await stream.finalMessage();
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        send(res, 500, JSON.stringify({ error: String(err && err.message || err) }), { 'Content-Type': 'application/json' });
      } else {
        res.end();
      }
    }
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`LuxeLoop AI proxy on http://localhost:${PORT}/api/ai (model: ${MODEL})`);
});
