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

## 구현 메모

- 모델: `claude-opus-5`, `max_tokens: 2048`, `thinking: { type: "adaptive" }`
- `@anthropic-ai/sdk` 의 `client.messages.stream(...)` 사용, `text` 이벤트를 응답 본문으로 흘려보냄
- CORS 허용 (`CORS_ORIGIN`, 기본 `*` — 운영에서는 프론트 오리진으로 제한 권장)

*Not an official Anthropic product.*
