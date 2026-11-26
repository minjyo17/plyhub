# 로컬 백엔드 실행 가이드

## 범위와 구성

Nakama와 PostgreSQL을 실행하고 playhub-test(수동 테스트), playhub-snake(게임) 리더보드를 생성한다. 3단계에서 Nuxt 테스트 화면과 실제 SDK 연결을 완료했다. 웹에서 게스트 로그인과 점수 제출을 하면 이 서버에 저장된다.

```text
Docker Compose 프로젝트: playhub-local
  nakama   → postgres:5432 / nakama 데이터베이스
      ↑          ↓
127.0.0.1    postgres_data 이름 있는 볼륨
7350 API
7351 관리 콘솔
```

- Nakama: 공식 이미지 `heroiclabs/nakama:3.37.0`
- PostgreSQL: `postgres:16-alpine` (16 버전 계열)
- 런타임 빌드: Node 22.22.3, TypeScript 5.9.3
- 공식 `nakama-common` v1.44.2 타입 파일과 Apache-2.0 라이선스를 `infra/nakama/types/nakama-runtime/`에 포함했다. Nakama 3.37.0의 의존 버전에 맞췄다.
- DB 포트는 호스트에 공개하지 않는다. API와 관리 콘솔은 127.0.0.1에만 바인딩한다.
- 컨테이너 이름을 전역 고정하지 않고 Compose 프로젝트 이름으로 구분한다.

## 준비

Docker Desktop과 Docker Compose v2가 필요하다. Docker Desktop이 실행된 상태여야 한다. 백엔드만 실행할 때는 호스트 Node나 npm 설치가 없어도 된다. TypeScript 런타임은 Docker 이미지 빌드 중 컴파일된다.

첫 실행에는 컨테이너 이미지와 TypeScript 패키지를 내려받을 네트워크 연결이 필요하다.

## 시작과 상태 확인

프로젝트 루트에서 실행한다.

```sh
docker compose up -d --build --wait --wait-timeout 120
docker compose ps
docker compose logs --tail=50 nakama
```

두 서비스가 `healthy`가 되면 준비 완료다. Nakama 로그에서 아래 메시지를 확인한다.

```text
PlayHub leaderboard ready: playhub-test
```

Node 환경이 준비돼 있으면 동일 작업을 npm 명령으로 실행할 수 있다.

```sh
npm run backend:up
npm run backend:status
npm run backend:logs
```

`backend:logs`는 계속 로그를 보여준다. Ctrl+C로 로그 보기만 종료해도 컨테이너는 유지된다.

## 접속 정보

| 항목 | 값 |
|---|---|
| HTTP / WebSocket API | http://127.0.0.1:7350 |
| 관리 콘솔 | http://127.0.0.1:7351 |
| 콘솔 사용자 | `admin` |
| 콘솔 비밀번호 | `playhub-local-console` |
| 클라이언트 서버 키 | `playhub-local-server-key` |
| 테스트 게임 ID | `test-game` |
| 리더보드 ID | `playhub-test` |

설정 파일의 비밀번호와 암호화 키는 로컬 데모 전용으로 의도적으로 고정한 값이다. 이 설정을 그대로 공개 배포에 사용하지 않는다. `socket.server_key`는 클라이언트 연결용이고 콘솔 비밀번호와 다르다.

관리 콘솔의 Leaderboards에서 `playhub-test`를 확인할 수 있다. 기본 실행은 실제 사용자나 점수를 자동 생성하지 않으므로 최초에는 비어 있다.

## 리더보드 정책

초기화 코드는 `infra/nakama/src/main.ts`의 전역 `InitModule`에 있다.

- 내림차순: 높은 점수가 위에 표시됨
- `best`: 개인 최고 점수를 유지
- `authoritative: false`: 로컬 데모용 클라이언트 점수 제출 허용
- 순위 계산 활성화
- 주기적 초기화 없음

`leaderboardCreate`는 같은 ID가 이미 있으면 기록을 보존한다. 기존 리더보드 설정까지 덮어쓰지는 않는다. 이후 정책을 바꾸려면 새 ID나 별도 마이그레이션을 계획해야 한다.

Nakama는 PostgreSQL이 준비된 뒤 DB 마이그레이션을 수행하고 시작한다. 런타임 생성에 실패하면 정상 시작으로 처리되지 않는다.

## 실제 API 확인

Node 22.22.3 환경에서 실행한다.

```sh
npm run backend:check
```

이 명령은 로컬 인프라 확인용 계정 `infra_check`로 다음을 검증한다.

1. 헬스체크와 디바이스 인증
2. 리더보드에 12,345점 제출
3. 낮은 점수 100점을 제출해도 최고 점수가 유지되는지 확인
4. 순위가 포함된 기록 조회

확인용 계정과 기록은 재시작 검증을 위해 DB에 남는다. 실제 게임 기록과 혼동하지 않도록 고정된 확인용 사용자명을 사용한다. 이 스크립트는 프론트엔드 SDK가 아니다.

이미 존재하는 확인용 계정과 기록을 점수 쓰기 없이 확인하려면:

```sh
npm run backend:verify
```

처음부터 `backend:verify`만 실행하면 확인용 계정이 없어서 실패할 수 있다. 먼저 `backend:check`를 실행한다.

## 재시작과 영속성 확인

일시 정지 후 다시 실행:

```sh
docker compose stop
docker compose up -d --wait --wait-timeout 120
npm run backend:verify
```

컨테이너를 제거하고 다시 생성해도 이름 있는 DB 볼륨은 유지된다.

```sh
npm run backend:down
npm run backend:up
npm run backend:verify
```

`docker compose down`은 이 프로젝트의 컨테이너와 네트워크를 정리하지만 DB 볼륨을 보존한다. **`down -v`는 DB 볼륨과 저장 기록도 삭제하므로 일반 종료에 사용하지 않는다.**

런타임 코드를 바꾼 뒤에는 `docker compose restart`만으로 이미지가 갱신되지 않는다. `npm run backend:up`으로 다시 빌드한다.

## 포트 충돌

기존 서비스를 종료할 필요 없이 호스트 포트를 바꿀 수 있다.

```sh
NAKAMA_HTTP_PORT=17350 NAKAMA_CONSOLE_PORT=17351 docker compose up -d --build --wait
NAKAMA_URL=http://127.0.0.1:17350 npm run backend:check
```

다음 실행에도 같은 포트를 쓰려면 프로젝트의 로컬 `.env` 파일에 `NAKAMA_HTTP_PORT`, `NAKAMA_CONSOLE_PORT`를 설정한다. `NAKAMA_URL`은 확인 스크립트에 직접 전달한다. 기본 확인 스크립트는 `.env`를 읽지 않는다. 프런트엔드는 `NUXT_PUBLIC_NAKAMA_URL=http://127.0.0.1:17350`처럼 API 주소를 함께 바꿔 실행한다.

## 주요 파일

| 파일 | 용도 |
|---|---|
| `docker-compose.yml` | 서비스·네트워크·볼륨·포트·헬스체크 |
| `infra/nakama/Dockerfile` | TypeScript 컴파일 후 Nakama 이미지에 배치 |
| `infra/nakama/local.yml` | 로컬 DB·인증 키·콘솔·런타임 설정 |
| `infra/nakama/src/main.ts` | 리더보드 생성 |
| `infra/nakama/tsconfig.json` | ES5 전역 런타임 컴파일 |
| `scripts/check-backend.mjs` | 실제 API와 점수 보존 확인 |

Nuxt의 `server/`와 Nakama 런타임은 별도로 관리한다. 공식 타입 파일은 출처와 체크섬을 함께 보관한다.

## 검증 기록 — 2026-11-13

- Docker Compose 설정 검사와 이미지 빌드 통과
- Nakama 런타임 ES5 컴파일 및 Nuxt 타입 검사 통과
- Nakama 3.37.0 / PostgreSQL 16.16, 두 서비스 `healthy`
- `playhub-test` 생성 로그 확인
- `backend:check`: 12,345점 저장, 낮은 점수 제출 후 유지, 순위 1 확인
- `docker compose down` 후 다시 생성하여 `backend:verify` 통과
- 관리 콘솔 HTTP 200 확인

초기 다운로드에서는 TLS 시간 초과와 Heroic Labs 프록시 레지스트리의 429 응답이 있었다. 재시도와 동일 공식 이미지의 Docker Hub 직접 사용으로 해결했다. Docker 전역 설정이나 TLS 검증은 변경하지 않았다.

## 참고 자료

- [Nakama Docker Compose 설치](https://heroiclabs.com/docs/nakama/getting-started/install/docker/)
- [Nakama TypeScript 런타임](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/)
- [리더보드 생성 API](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/function-reference/#leaderboardcreate)
