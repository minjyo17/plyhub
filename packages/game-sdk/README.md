# @playhub/game-sdk

독립 웹 게임용 ESM SDK v0.1.0. 로컬 패키지이며 아직 npm에 게시하지 않았습니다.

```js
import { connectPlayHub } from '@playhub/game-sdk'
const playhub = await connectPlayHub({ platformOrigin: 'http://127.0.0.1:3317' })
await playhub.submitScore(10)
const ranking = await playhub.getTop(10)
// 실시간 방: 같은 코드로 들어온 사람끼리 메시지를 주고받는다
const room = await playhub.joinRoom('K7Q2X9')
room.onMessage((data, from) => console.log(from.displayName, data))
await room.send({ hello: true })
playhub.dispose()
```

PlayHub가 등록한 iframe에서만 연결됩니다. 게임은 사용자 로그인이나 Nakama 토큰을 다루지 않습니다. 설치·오류·주소 설정은 저장소의 docs/GAME_SDK.md와 /guide를 참고하세요.
