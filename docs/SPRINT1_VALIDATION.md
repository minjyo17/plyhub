# S1 최종 검증 기록

검증일: 2026-11-13. 대상: 로컬 게임 플랫폼, 외부 게임 SDK, 독립 Snake Garden, Nakama/PostgreSQL.

## 검증 환경

| 구분 | 원래 개발 환경 | 새 설치 재현 환경 |
|---|---|---|
| 포털 실행 | macOS Node 22.22.3, 3317 | Linux Alpine Node 22.22.3 컨테이너, 3327 |
| 의존성 | 기존 설치 | node_modules·npm 캐시 없는 새 컨테이너에서 npm ci |
| 소스 | 원래 저장소 | .git·설치/빌드 결과·.env 제외 복사본 |
| 게임 | 독립 서버 3318 | Linux에서 새로 빌드한 dist를 독립 정적 서버 3319로 제공 |
| 백엔드 | playhub-local, 7350/7351 | playhub-s1-verify, 17350/17351 |
| DB | 기존 기록 유지 | 검증 전용 신규 PostgreSQL 볼륨 |
| 브라우저 | 별도 테스트 세션 | 또 다른 독립 테스트 세션 |

새 환경은 같은 Mac의 Docker Desktop에서 만든 Linux 실행 환경이다. 다른 물리 PC·Windows·다른 CPU 아키텍처까지 검증한 것은 아니다. 정적 게임 파일의 제공 프로세스는 호스트 Node 22.22.3을 사용했다.

복사본에서는 문서의 주소 변경 절차대로 샘플 allowedPlatforms에 `http://127.0.0.1:3327`만 추가했다. 포털에는 `NUXT_PUBLIC_NAKAMA_URL=http://127.0.0.1:17350`, `NUXT_PUBLIC_SNAKE_GAME_URL=http://127.0.0.1:3319`를 지정했다. 원래 프로젝트의 허용 출처와 기존 DB는 바꾸지 않았다.

## 결과

- [x] 새 Linux 환경에서 루트 npm ci 성공 (538개 패키지)
- [x] 독립 게임 npm ci 성공 (로컬 SDK 패키지 연결)
- [x] 루트 SDK·인증·브리지 테스트 17건 통과
- [x] 게임 로직 테스트 9건 통과
- [x] Nuxt 타입 검사 통과
- [x] Nuxt 프로덕션 빌드와 게임 정적 빌드 통과
- [x] 빈 DB에서 리더보드 초기화와 두 서비스 healthy 확인
- [x] 원래 환경의 홈 → 상세 → 로그인 → 게임 연결
- [x] 실제 게임 1판 종료 후 10점 저장, 다음 판 다시하기로 10점 재제출
- [x] 상세 → 목록 → 상세 → 플레이 재진입 후 10점 제출
- [x] 위 세 판에서 점수 POST 성공은 각각 1회, 총 3회
- [x] 새 환경에서 실제 게임 종료 10점이 빈 랭킹의 1위로 반영
- [x] 새 환경에서 12,345점 이후 100점 제출해도 최고 기록 12,345 유지
- [x] 새 환경의 서버를 down/up으로 재생성한 후 기존 계정·기록 조회 성공
- [x] 재시작 후 브라우저 새로고침에서 동일 사용자와 Snake Garden 10점·1위 유지
- [x] 브라우저별 서로 다른 게스트 인증과 독립 DB의 데이터 분리 확인
- [x] 최신 화면에서 점수 쓰기 실패 1회 → 10점 보관 안내 → 재시도 성공 1회
- [x] 원래 환경과 새 환경의 테스트 브라우저 오류 목록 비어 있음

저장 실패·재시도는 테스트 브라우저의 fetch만 일시적으로 바꿔 점수 쓰기에 네트워크 오류를 넣었다. 애플리케이션에 실패 시뮬레이션 코드를 추가하지 않는다. 기존 단계의 저장 성공 후 랭킹 조회 실패·재조회, 모바일 390px 확인도 WORK_PLAN.md에 기록되어 있다.

## 재현 방법

일반 사용자 실행은 [데모 가이드](SPRINT1_DEMO.md)의 두 터미널 절차를 따른다. 아래는 이번에 사용한 격리 검증 방식이다. CLEAN_DIR에는 기존 node_modules·빌드 결과·.env·.git을 제외한 저장소 복사본의 절대 경로를 지정한다.

```sh
# 새 Linux 설치·테스트·빌드
 docker run --rm -v "$CLEAN_DIR:/app" -w /app node:22.22.3-alpine sh -ec '
  npm ci --no-audit --no-fund
  npm test
  npm run typecheck
  npm run build
  cd examples/games/sdk-demo
  npm ci --no-audit --no-fund
  npm test
  npm run build
 '

# 복사본에서 별도 DB 실행
cd "$CLEAN_DIR"
NAKAMA_HTTP_PORT=17350 NAKAMA_CONSOLE_PORT=17351 docker compose -p playhub-s1-verify up -d --build --wait --wait-timeout 120
NAKAMA_URL=http://127.0.0.1:17350 node scripts/check-backend.mjs
```

게임의 allowedPlatforms에 검증 포털 출처를 추가한 뒤 게임을 다시 빌드한다. 포털은 위 환경 변수를 전달해 3327로 공개하고, 게임은 `PORT=3319 npm run preview`로 실행한다. Linux에서 설치한 node_modules를 macOS 개발 실행에 재사용하지 않는다.

## 보존과 정리

실행 코드·문서·lockfile·ignore 파일을 최초 커밋하고 `s1-demo` 태그로 보존한다. node_modules, .output, dist, .env 및 브라우저 테스트 상태는 커밋하지 않는다. 검증 전용 서버·볼륨은 확인 후 정리하며 기존 playhub-local 볼륨과 실행 중인 3317/3318 환경은 유지한다.
