// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/config.js — AI 백엔드 엔드포인트 설정.
//
// 데모(기본): 빈 문자열 "" 이면 브라우저에서 결정론적 한국어 MockProvider 가 동작합니다.
//             API 키는 절대 브라우저/저장소에 두지 않습니다.
// 실 연동:    server/ 프록시를 띄운 뒤 이 값을 프록시 URL 로 설정하세요.
//             예) export const AI_ENDPOINT = "http://localhost:8787/api/ai";
//
// ⚠ 이 파일에는 절대 API 키를 넣지 마세요. 키는 오직 server/ (백엔드)에만 둡니다.
export const AI_ENDPOINT = "";
