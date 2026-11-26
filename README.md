# PlayHub

Nuxt 4 + Vue 3 + TypeScript 기반 웹 게임 플랫폼의 기본 프로젝트입니다.
독립 스네이크 게임 → 공개 PlayHub SDK → 포털 브리지 → Nakama → PostgreSQL까지 연결되어 있습니다.

## 웹 문서

- `/`: 게임 목록·검색과 로그인
- `/games/snake`: 게임 소개·플레이 버튼·랭킹
- `/dev/test`: 개발용 수동 점수 테스트
- `/play/snake`: 별도 주소의 스네이크 게임 실행·실제 랭킹
- `/sdk`: 기존 Nakama 구조 도식, 플랫폼 개발 작업 1~4, 권장 샘플 게임 위치
- `/guide`: 게임 개발자를 위한 연결·점수 제출·실패 처리·랭킹·게임 등록 가이드

공개 SDK는 `packages/game-sdk/`, 독립 샘플은 `examples/games/sdk-demo/`에 있습니다. 로컬 npm 패키지로 연결하며 레지스트리에 게시하지 않았습니다. 재현 방법과 API는 [게임 SDK 연동 가이드](docs/GAME_SDK.md)를 참고하세요.

## 프로젝트 문서

- [프로젝트 배경과 현재 범위](docs/PROJECT_BACKGROUND.md)
- [스프린트 작업 계획과 완료 기준](docs/WORK_PLAN.md)
- [로컬 백엔드 실행·종료·재시작 가이드](docs/LOCAL_BACKEND.md)
- [S1 데모 실행 순서와 제약](docs/SPRINT1_DEMO.md)
- [S1 최종 검증·Linux 설치 재현 결과](docs/SPRINT1_VALIDATION.md)

## 로컬 실행

Node.js 22.22.3을 사용합니다. nvm이 설치되어 있다면:

```sh
cd /Users/jhomin/workspace/playhub
nvm install
nvm use
npm ci
npm run backend:up
npm run dev
```

개발 서버는 기본적으로 http://localhost:3000 에서 실행됩니다.
`nvm use`는 현재 셸에서 프로젝트의 Node 버전을 선택합니다.

현재 로컬 환경에는 사용자 `.npmrc`의 prefix 설정과 nvm 사이의 충돌이 있습니다.
기존 전역 설정은 변경하지 않았으며, Node 22.22.3은 설치되어 있습니다.
이 환경에서는 다음처럼 현재 터미널의 PATH만 지정해서 실행할 수 있습니다.

```sh
export PATH="/Users/jhomin/.nvm/versions/node/v22.22.3/bin:$PATH"
node --version
npm run dev
```

Node 22.22.3으로 `npm ci`, `npm run typecheck`, `npm run build`도 실행할 수 있습니다.

## 로컬 백엔드

Docker Desktop을 실행한 뒤 프로젝트 루트에서:

```sh
npm run backend:up
npm run backend:check
```

호스트 Node 없이 Docker만으로 시작하려면 `docker compose up -d --build --wait --wait-timeout 120`을 사용합니다.

- API: http://127.0.0.1:7350
- 관리 콘솔: http://127.0.0.1:7351 (`admin` / `playhub-local-console`, 로컬 전용)
- 리더보드: `playhub-test`(수동 테스트), `playhub-snake`(게임) — 최고 점수 유지, 내림차순
- 상태 확인: `npm run backend:status`
- 로그: `npm run backend:logs`
- 종료: `npm run backend:down` — DB 볼륨과 기록 유지
- 재실행: `npm run backend:up`
- 저장 기록 확인: `npm run backend:verify` — 먼저 `backend:check`를 한 번 실행

재시작·포트 변경·확인용 데이터 설명은 [로컬 백엔드 가이드](docs/LOCAL_BACKEND.md)를 참고합니다. `backend:check`는 인프라 검증 스크립트이며 프론트엔드 SDK가 아닙니다.

## 검증 및 빌드

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

- `typecheck`: Vue 및 TypeScript 타입 검사
- `test`: SDK의 게스트 ID 보존·인증 복구·입력 검증·재시도 정책 테스트
- `build`: Nuxt 프로덕션 빌드
- `preview`: 빌드 결과 로컬 미리보기
- `generate`: 정적 사이트 생성이 필요한 경우 사용

Nuxt 빌드는 기본적으로 타입 검사를 별도로 수행하지 않으므로 `typecheck`도 실행합니다.
독립적인 린터는 아직 구성하지 않았습니다.

## 구조

```text
app/app.vue                          공통 메뉴와 페이지 라우팅
app/pages/index.vue                  게임 카탈로그 (/)
app/pages/games/[id].vue             게임 상세·플레이 진입·랭킹
app/pages/dev/test.vue               개발용 수동 점수 테스트
app/plugins/playhub.ts               앱 전역 게스트 로그인과 세션
app/pages/sdk.vue                    플랫폼 구조와 개발 계획 (/sdk)
app/pages/guide.vue                  게임 개발자 사용 가이드 (/guide)
app/composables/useTestScreen.ts      화면 상태 및 실제 요청 처리
app/lib/playhub.ts                   Nakama SDK 래퍼와 세션 관리
tests/playhub.test.mjs                인증 복구·저장소·랭킹 SDK 테스트
nuxt.config.ts                       Nuxt 설정
public/                              정적 파일
docker-compose.yml                   Nakama·PostgreSQL 실행
infra/nakama/                        런타임 초기화 코드·Docker 빌드·설정
scripts/check-backend.mjs             백엔드 API 및 점수 보존 확인
```

## 현재 범위

- 브라우저에서 게스트로 로그인하면 실제 Nakama 계정이 생성됩니다.
- 입력한 점수는 `playhub-test`에 저장되며 낮은 점수를 제출해도 최고 기록이 유지됩니다.
- 상위 10명과 내 기록을 따로 조회하므로 10위 밖에서도 내 순위를 볼 수 있습니다.
- 새로고침하면 저장한 UUID로 자동 로그인합니다. 다른 브라우저 프로필은 다른 계정입니다.
- 요청 실패 시 입력을 유지하고 재시도할 수 있습니다. 저장 성공 후 랭킹 조회만 실패하면 저장 성공 안내를 유지합니다.
- 서버 구조 도식도 현재 SDK 연결 상태를 반영합니다.
- `/play/snake`에서 실제 게임 종료 점수를 별도 랭킹에 자동 저장합니다. 게임 주소를 직접 열면 연습 모드입니다.

### 게스트 계정과 인증

`localStorage`의 `playhub.guest.v1:<Nakama origin>` 키에 무작위 UUID를 저장합니다. JWT와 refresh token은 메모리에서만 관리하며 새로고침 시 같은 UUID로 다시 인증합니다. 서버 렌더링에서는 브라우저 저장소나 세션을 생성하지 않습니다.

같은 사이트 주소·포트·브라우저 프로필에서 계정이 유지됩니다. 사이트 저장소를 지우거나 시크릿 창을 닫으면 기존 계정으로 돌아올 수 없을 수 있습니다. 서버의 점수는 별도로 남습니다. UUID는 인증 수단이므로 공유하지 않습니다. “같은 게스트로 다시 연결”은 계정·점수를 삭제하지 않습니다.

세션 만료가 가까우면 refresh하고, 만료된 refresh token이나 HTTP 401은 같은 게스트로 재인증합니다. 인증 거부만 1회 재시도하며 네트워크 오류가 난 점수 쓰기는 자동 재전송하지 않습니다. 각 요청의 제한 시간은 10초입니다.

### 프런트엔드 접속 설정

Nuxt `runtimeConfig.public`에서 다음 환경 변수를 사용합니다. 개발 서버 실행 전에 설정하고, 프로덕션 Node 서버에도 실행 환경 변수로 전달합니다.

```sh
NUXT_PUBLIC_NAKAMA_URL=http://127.0.0.1:7350
NUXT_PUBLIC_NAKAMA_SERVER_KEY=playhub-local-server-key
```

URL은 경로가 없는 HTTP(S) origin이어야 합니다. `NAKAMA_HTTP_PORT`로 Docker 호스트 포트를 바꾸면 `NUXT_PUBLIC_NAKAMA_URL`도 맞춰 주세요. 클라이언트 서버 키는 공개되는 연결 설정이며 콘솔 비밀번호·DB 비밀번호·서명 키를 넣으면 안 됩니다.

### 확인 순서

1. Docker Desktop을 켜고 `npm run backend:up`, `npm run dev`를 실행합니다.
2. 게스트로 시작한 뒤 사용자명과 서버 랭킹을 확인합니다.
3. 높은 점수를 제출한 다음 낮은 점수를 제출해 최고 기록 유지를 확인합니다.
4. 새로고침 후 같은 사용자명과 내 기록이 표시되는지 확인합니다.
5. 별도 브라우저 프로필에서 다른 계정으로 점수를 제출한 뒤 첫 화면의 랭킹을 새로고침합니다.
6. Nakama 콘솔의 Players / Leaderboards에서도 동일 계정과 점수를 확인할 수 있습니다.

로컬 Git 저장소와 프로젝트 전용 작성자 설정은 완료했습니다. GitHub 인증은 사용자가 직접 설정하며, 원격 저장소는 아직 연결하지 않았습니다.
S1 최종 통합 검증과 새 Linux 설치 재현까지 완료했습니다. 최초 커밋과 로컬 s1-demo 태그로 시연 버전을 보존합니다.

## 참고

- https://nuxt.com/docs/4.x/getting-started/installation
- https://nuxt.com/docs/4.x/guide/concepts/typescript

## 독립 게임 실행

포털과 별도의 터미널에서 실행합니다.

```sh
cd examples/games/sdk-demo
npm ci
npm run dev
```

포털의 `/play/snake`로 접속해 게스트로 게임을 엽니다. 게임 서버는 기본 3318입니다.
포털을 3317로 실행하려면 `npm run dev -- --host 127.0.0.1 --port 3317`을 사용합니다.
3318을 직접 열면 연습 모드이고 서버 점수는 저장하지 않습니다.

## 게임 플랫폼 화면

홈 → 게임 상세 → 플레이 순서로 이용합니다. 상단 로그인은 기존 게스트 인증을 사용합니다.
로그인 상태는 페이지 이동 중 공유되며 새로고침 후 같은 브라우저 계정을 복원합니다.
상세 랭킹은 로그인 후 표시하고, 비로그인 상태에서는 로그인 안내를 제공합니다.
로그아웃은 현재 세션에서 자동 복원을 멈추며 계정 식별자와 서버 기록은 지우지 않습니다.
다시 로그인하면 같은 기록을 이어갑니다. 현재 등록된 게임은 Snake Garden 한 개입니다.
