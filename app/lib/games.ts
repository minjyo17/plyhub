// Platform-owned registry. Only playable, registered games appear in the catalogue.
// urlKey: nuxt.config.ts runtimeConfig.public에서 게임 실행 주소를 읽는 키
// frameHeight: 게임이 높이를 알려주기 전까지 쓰는 iframe 기본 높이(px)
export const games = [{
  id: 'snake', title: 'Snake Garden', subtitle: '한 입 더. 조금 더 길게.',
  description: '먹이를 모으고, 벽을 피하고, 최고 기록에 도전하세요.',
  genre: '아케이드', tags: ['아케이드', '싱글 플레이'],
  controls: '방향키 · WASD · 화면 방향 버튼',
  controlsNote: 'Space로 일시정지 · 탭을 벗어나면 자동 정지',
  aboutTitle: '작은 정원에서, 더 큰 기록으로.',
  about: '작은 정원에서 시작하는 스네이크 게임입니다. 먹이를 먹을수록 몸이 길어지고 움직임이 빨라집니다. 벽과 내 몸을 피하며 정원을 자유롭게 누벼보세요.',
  rules: ['먹이를 먹을 때마다 10점을 얻어요.', '벽이나 내 몸에 닿으면 한 판이 끝나요.', '가장 높은 점수가 랭킹에 남아요.'],
  urlKey: 'snakeGameUrl', frameHeight: 870,
}, {
  id: 'cosmic-merge', title: '코스믹 머지', subtitle: '별가루에서 블랙홀까지.',
  description: '같은 천체 두 개를 밀어 붙이면 한 단계 큰 천체가 돼요.',
  genre: '퍼즐', tags: ['퍼즐', '싱글 플레이'],
  controls: '방향키 · WASD · 스와이프',
  controlsNote: '한 번 밀면 모든 천체가 같은 방향으로 움직여요',
  aboutTitle: '작은 별가루가 은하가 될 때까지.',
  about: '4×4 우주에서 같은 천체를 합쳐 더 큰 천체로 키우는 퍼즐입니다. 별가루가 운석이 되고, 행성과 항성을 지나 블랙홀까지 진화합니다. 칸이 가득 차서 더 움직일 수 없으면 한 판이 끝나요.',
  rules: ['같은 천체 두 개가 부딪히면 한 단계 큰 천체가 돼요.', '큰 천체를 만들수록 점수를 많이 얻어요.', '더 이상 움직일 수 없으면 끝. 최고 점수가 랭킹에 남아요.'],
  urlKey: 'cosmicMergeGameUrl', frameHeight: 820,
}, {
  id: 'mungtari', title: '멍타리 대전', subtitle: '울타리 너머, 뼈다귀 한 방.',
  description: '바람을 읽고 힘을 조절해서 옆집 강아지 보리를 먼저 쓰러뜨리세요.',
  genre: '턴제 대전', tags: ['턴제', '대전', '봇 대전'],
  controls: '마우스 조준 · 꾹 눌러 힘 모으기 · 떼면 발사',
  controlsNote: '게이지를 끝까지 채우면 맵 밖으로 날아가요',
  aboutTitle: '바람은 매 턴 바뀌어요.',
  about: '이웃집 강아지 콩이와 보리가 울타리를 사이에 두고 뼈다귀를 던집니다. 매 턴 바뀌는 바람을 계산해 각도와 힘을 정하고, 더블 뼈다귀·왕뼈다귀 같은 아이템으로 승부를 뒤집어 보세요.',
  rules: ['직격 25, 머리 명중 35, 근처에 떨어지면 10 데미지.', '보리의 HP를 먼저 0으로 만들면 승리해요.', '이기면 남은 HP·빨리 이긴 정도·난이도로 점수가 매겨져요.'],
  urlKey: 'mungtariGameUrl', frameHeight: 760,
}] as const
export type Game = (typeof games)[number]
export function findGame(id: unknown): Game | undefined {
  return games.find(game => game.id === id)
}
export function gameUrl(value: string, portalOrigin: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin === portalOrigin) throw new Error('게임은 포털과 다른 HTTP(S) 출처에서 실행해야 합니다.')
  return url
}
