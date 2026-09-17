<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# LuxeLoop AI Proxy (server/)

실제 Claude 를 호출하는 **선택적** 백엔드 프록시입니다. 데모는 이 서버 없이도
`ai/` 의 결정론적 MockProvider 로 완전히 동작합니다. 실제 AI 응답을 쓰고 싶을 때만 사용하세요.

## 🔒 보안 원칙 (필독)

- **API 키는 오직 이 백엔드에만** 둡니다 (`ANTHROPIC_API_KEY` 환경변수).
- **브라우저·리포지토리에는 절대 키를 넣지 않습니다.** 프론트엔드는 이 프록시 URL만 호출합니다.
- `.env` 는 커밋 금지 (`.gitignore` 에 포함). `.env.example` 만 커밋합니다.

## 실행

```bash
cd server
cp .env.example .env        # .env 에 ANTHROPIC_API_KEY 입력
npm install                 # @anthropic-ai/sdk 설치
npm start                   # http://localhost:8787/api/ai
```

그런 다음 프로젝트 루트의 `ai/config.js` 를 다음처럼 설정하세요:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

이제 프론트엔드의 AI 기능이 MockProvider 대신 실제 Claude 응답을 스트리밍합니다.

## API

`POST /api/ai`

요청 본문:

```json
{ "task": "chat", "payload": { "message": "...", "items": [ ... ] } }
```

- `task`: `"chat"`(대여 상담), `"styling"`(코디 추천), `"authenticity"`(안전 거래 안내)
- 응답: `text/plain` 스트림 (토큰 델타를 순서대로 전송)

## 구현 메모 (저비용 설계)

- 모델: 기본 `claude-haiku-4-5` (비용 우선). `AI_MODEL` 로 `claude-sonnet-5`/`claude-opus-5` 상향 가능
- **프롬프트 캐싱**: 태스크별 시스템 프롬프트를 `cache_control:{type:'ephemeral'}` 블록으로 전송 → 반복 호출 시 캐시 read 로 비용 절감
- **thinking/effort**: `claude-haiku*` 는 adaptive thinking/effort 미지원 → 전송하지 않음(400 방지). 그 외 모델은 `thinking:{type:'adaptive'}` + `output_config:{effort: AI_EFFORT || 'low'}`
- **출력 상한**: 태스크별 `max_tokens` 를 낮게(chat/styling 700, authenticity 900) 유지
- **비용 가드레일**: IP별 분당 호출 제한(`AI_RATE_LIMIT_PER_MIN`, 기본 20) + 월간 토큰 예산(`AI_MONTHLY_TOKEN_CAP`, 기본 2,000,000). 초과 시 `429 {fallback:true}` → 프론트가 목업으로 자동 폴백
- `@anthropic-ai/sdk` 의 `client.messages.stream(...)` 사용, `text` 이벤트를 응답 본문으로 흘려보냄. 스트림 최종 메시지의 `usage` 로 월간 토큰 누적
- CORS 허용 (`CORS_ORIGIN`, 기본 `*` — 운영에서는 프론트 오리진으로 제한 권장)

## ☁️ Cloudflare Workers 원클릭 배포 (무인·무료 티어)

서버를 관리할 필요 없이(무료 티어) 항상 켜져 있는 무인 배포입니다. `worker.js` 는 Node 프록시와
동일한 task 라우팅 + 모델/캐싱/thinking 규칙으로 Anthropic REST(`POST /v1/messages`)를 직접 호출합니다.

```bash
cd server
npm i -g wrangler                       # 최초 1회
wrangler login                          # Cloudflare 계정 로그인
wrangler secret put ANTHROPIC_API_KEY   # 키는 Secret 으로만 주입 (리포/브라우저 금지)
wrangler deploy                         # https://luxeloop-ai-proxy.<계정>.workers.dev
```

배포 후 프론트 `ai/config.js` 의 `AI_ENDPOINT` 를 Worker URL(`.../api/ai`)로 설정하면 됩니다.
모델/비용은 `wrangler.toml` 의 `[vars] AI_MODEL` 로 조절합니다.

> **🔒 키는 오직 서버/Worker Secret 에만.** 브라우저·리포지토리에는 절대 두지 않습니다.
> 호출이 실패하거나 429 가 반환돼도 프론트는 목업으로 자동 폴백하므로 앱은 멈추지 않습니다(무인).

*Not an official Anthropic product.*
