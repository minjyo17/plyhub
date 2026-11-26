# Snake Garden

PlayHub와 독립적으로 실행하는 순수 HTML/CSS/JavaScript 스네이크 샘플 게임입니다. 플랫폼 내부 코드나 Nakama를 참조하지 않고 공개 @playhub/game-sdk만 사용합니다.

## 실행

Node.js 22 이상에서 로컬 SDK 패키지를 설치한 뒤 실행합니다.

```sh
cd /Users/jhomin/workspace/playhub/examples/games/sdk-demo
npm ci
npm run dev
```

게임 주소: http://127.0.0.1:3318

다른 포트가 필요하면 `PORT=3319 npm run dev`로 실행합니다. 포털(3317)과 게임(3318)은 별도 프로세스입니다. Nakama나 Docker를 켜지 않아도 게임이 실행됩니다.

## 게임 규칙

- 방향키 / WASD / 화면 방향 버튼으로 이동
- 먹이당 10점, 몸 길이 1칸 증가
- 50점마다 이동 간격 감소 (최소 75ms)
- 벽이나 몸에 부딪히면 종료, 모든 칸을 채우면 승리
- Space / Escape / 일시정지 버튼으로 멈춤 (계속하기 또는 Space로 재개)
- 다른 탭·창으로 이동하면 자동 일시정지
- 다시하기 또는 새 게임 버튼으로 점수와 게임판 초기화
- 최고 점수는 이 게임 주소의 localStorage에만 저장; 서버 랭킹과 무관

## 검증과 정적 빌드

```sh
npm test
npm run build
npm run preview
```

`dist/`를 정적 호스팅의 루트로 배포할 수 있습니다. 현재 정적 파일 경로는 `/src/...`로, 도메인 루트 제공을 기준으로 합니다.

## 코드

- `src/engine.js`: DOM과 분리된 이동·먹이·충돌·점수 규칙
- `src/main.js`: Canvas 표시, 키보드·방향 버튼, 일시정지, 로컬 최고 기록
- `src/style.css`: 반응형 게임 화면
- `server.mjs`: Node 내장 모듈만 사용하는 로컬 정적 서버
- `build.mjs`: 정적 배포 파일 복사

게임 종료 결과는 src/platform.js에서 공개 SDK로 전달합니다. 포털 내부 모듈이나 Nakama 인증 코드를 게임에 추가하지 않습니다.

PlayHub의 http://127.0.0.1:3317/play/snake 에서 열면 서버 저장 모드입니다. 3318 주소를 직접 열면 연습 모드입니다. 저장 실패 시 미저장 최고 점수를 메모리에 유지하고 재시도할 수 있습니다. 재시도 전 새로고침하면 미저장 점수는 사라집니다.

자세한 연동과 주소 설정은 ../../../docs/GAME_SDK.md를 참고하세요.

## 검증 기록

- `npm test`: 이동·방향 큐·충돌·먹이·일시정지·승리·초기화 등 9건 통과
- `npm run build`: 정적 파일 생성 확인
- 브라우저: 첫 먹이 10점, 키보드와 방향 버튼 이동, 자동 정지, 정지 중 위치 유지, 벽 충돌 종료, 다시하기 확인
- 새로고침 후 브라우저 최고 기록 유지 확인
- 모바일 390px 가로 넘침 없음
