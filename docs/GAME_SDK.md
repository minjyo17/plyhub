# 독립 게임 SDK 연동

## 실행

Node 22.22.3과 Docker Desktop을 사용합니다. 이미 실행 중이면 서버를 중복 실행할 필요가 없습니다.

터미널 1, 저장소 루트:

```sh
npm ci
npm run backend:up
npm run dev -- --host 127.0.0.1 --port 3317
```

터미널 2, 저장소 루트에서 시작:

```sh
cd examples/games/sdk-demo
npm ci
npm run dev
```

http://127.0.0.1:3317/ 에서 게임 카드를 선택하고 상세 화면의 플레이하기를 누릅니다. 비로그인 상태라면 게스트 로그인 창을 거쳐 게임이 열립니다. 직진하면 첫 먹이를 먹은 뒤 벽에 닿아 10점으로 종료됩니다. 게임 패널과 포털 랭킹의 저장 결과를 확인합니다. Nakama 콘솔의 Leaderboards → `playhub-snake`에서도 확인할 수 있습니다.

http://127.0.0.1:3318 을 직접 열면 연습 모드입니다. 게임 자체는 백엔드 없이 동작하지만 서버 저장은 하지 않습니다.

## API와 패키지

`packages/game-sdk`는 Nakama·Nuxt에 의존하지 않는 ESM 패키지이며 TypeScript 선언을 포함합니다. npm 레지스트리에는 게시하지 않았습니다. 다른 번들러 프로젝트에서는 `npm install /절대/경로/playhub/packages/game-sdk`로 설치할 수 있습니다.

```js
import { connectPlayHub } from '@playhub/game-sdk'
const playhub = await connectPlayHub({ platformOrigin: 'http://127.0.0.1:3317' })
// playhub.user: { userId, displayName }; playhub.gameId: 'snake'
await playhub.submitScore(10)
const { records, myRecord } = await playhub.getTop(10)
// 사용을 마쳤을 때
playhub.dispose()
```

스네이크 샘플은 번들러를 쓰지 않으므로 설치한 SDK를 게임 서버의 `/sdk/playhub.js`로 제공하고 해당 URL에서 import합니다. `npm run build`는 SDK도 `dist/sdk/playhub.js`로 복사합니다. 게임은 플랫폼 내부 파일을 import하지 않습니다. 다른 저장소로 옮길 때는 file 의존성 경로를 설치된 SDK 위치로 변경합니다.

- submitScore: 정수 0~1,000,000,000, BEST 규칙으로 최고 기록 유지
- getTop: limit 1~100, 기본 10. records와 myRecord를 반환
- 기본 요청 제한 15초, timeoutMs로 100~60000ms 설정 가능
- 오류 code: NOT_EMBEDDED, INVALID_ORIGIN, INVALID_ARGUMENT, TIMEOUT, DISCONNECTED, BUSY, BACKEND_UNAVAILABLE, INVALID_RESPONSE
- 점수 쓰기는 자동 재전송하지 않음. 실패 시 저장 여부가 불확실할 수 있으므로 최종 점수 보관 후 명시적 재시도
- dispose: 리스너 제거, 남은 요청 거부. 다시 연결하려면 connectPlayHub 재호출

## 파일과 책임

| 위치 | 역할 |
|---|---|
| examples/games/sdk-demo/src/main.js | 실제 게임 종료 때 recordFinalScore 호출 |
| examples/games/sdk-demo/src/platform.js | 공개 SDK 호출, 미저장 최고 점수 보관, 재시도, 랭킹 UI |
| packages/game-sdk/index.js | postMessage 연결·요청 ID·시간 초과·응답 검증 |
| app/lib/game-bridge.ts | 등록 출처와 iframe 확인, 게임 ID 고정, 요청 중복 처리 |
| app/pages/play/snake.vue | 게스트 인증, iframe 실행, 브리지 수명 관리, 포털 랭킹 |
| app/lib/games.ts, nuxt.config.ts | 등록 게임 정보와 실행 URL |
| app/lib/playhub.ts | 실제 Nakama 호출, 토큰 보관·갱신, snake → playhub-snake 매핑 |
| infra/nakama/src/main.ts | 최고 기록을 유지하는 playhub-snake 리더보드 생성 |

## 주소 변경

포털 실행 시 `NUXT_PUBLIC_SNAKE_GAME_URL=http://127.0.0.1:3319`처럼 지정하면 다른 게임 서버 주소를 등록할 수 있습니다. 게임 서버는 `PORT=3319 npm run dev`로 실행합니다. 포털과 게임은 서로 다른 origin이어야 합니다.

게임 측 `src/platform.js`의 allowedPlatforms에는 127.0.0.1/localhost의 3317·3000 포트만 등록되어 있습니다. 실제 배포 도메인으로 변경할 때 이 목록과 직접 실행 모드의 포털 링크도 맞춥니다. 포털이 넘기는 platformOrigin 쿼리도 이 목록을 통과해야 합니다. HTTPS 환경에서는 게임과 백엔드도 HTTPS로 제공합니다. 게임 호스팅의 frame-ancestors/X-Frame-Options 설정이 포털 임베딩을 허용해야 합니다.

## 메시지 경계

채널은 playhub.sdk.v1. method는 connect, submitScore, getTop만 허용합니다. 양쪽에서 event.origin과 event.source를 확인하고 targetOrigin을 명시합니다. 포털은 등록된 gameId만 사용하며 게임이 다른 게임 ID를 보낼 수 없습니다. 공개 사용자 정보만 응답하고 JWT·refresh token·서버 설정은 게임에 전달하지 않습니다.

연결 ID로 재진입 이전 응답을 무시합니다. 최근 요청 ID를 메모리 캐시에서 중복 처리하고 동시 처리 요청은 16개로 제한합니다. 이는 영구적인 exactly-once 보장이 아닙니다. 서버의 BEST 규칙으로 재제출해도 최고 기록이 낮아지지 않습니다. 점수 진위 검증이나 공개 서비스 수준의 서버 권위 판정은 아직 구현하지 않았습니다.

샘플은 저장 중 새 판을 시작해도 미저장 최고 점수를 유지합니다. 이 보관함은 메모리이므로 새로고침·페이지 닫기 전에 재시도해야 합니다. 랭킹 실패와 저장 실패는 따로 표시합니다.

## 검증 명령

루트: `npm test`, `npm run typecheck`, `npm run build`.
게임 디렉터리: `npm test`, `npm run build`.
브라우저 확인: 연결 → 한 판 종료 → 양쪽 랭킹 → 새로고침 후 같은 기록 → 저장 실패·재시도 → 직접 접속 연습 모드.
