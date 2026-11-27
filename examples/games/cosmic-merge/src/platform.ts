// PlayHub 포털과의 연결. 게임은 Nakama를 직접 부르지 않고, 공개 SDK로 포털에 부탁한다.
// 포털 iframe 안에서만 연결되고, 주소를 직접 열면 연습 모드(서버 저장 없음)다.
import { connectPlayHub, type PlayHub, type RankEntry } from '@playhub/game-sdk';

// 배포 도메인이 생기면 여기에 추가한다. 쿼리로 들어온 아무 출처나 믿지 않는다.
const ALLOWED_PLATFORMS = new Set([
  'http://127.0.0.1:3317',
  'http://localhost:3317',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://plyhub.vercel.app', // 배포 포털
]);

export const embedded = window.parent !== window;
const platformOrigin = new URLSearchParams(location.search).get('platformOrigin') ?? '';

let sdk: PlayHub | null = null;

/** 연결된 SDK. 연습 모드이거나 연결에 실패하면 null. */
export const connection: Promise<PlayHub | null> =
  embedded && ALLOWED_PLATFORMS.has(platformOrigin)
    ? connectPlayHub({ platformOrigin }).then(
        (s) => (sdk = s),
        () => null,
      )
    : Promise.resolve(null);

export type SaveResult = 'saved' | 'practice' | 'offline' | 'failed';

/** 최종 점수 저장. 서버는 플레이어별 최고 점수만 남긴다. */
export async function saveScore(score: number): Promise<SaveResult> {
  if (!embedded) return 'practice';
  const s = await connection;
  if (!s) return 'offline';
  try {
    await s.submitScore(Math.max(0, Math.floor(score)));
    return 'saved';
  } catch {
    return 'failed';
  }
}

export async function topRanks(limit = 5): Promise<{ records: RankEntry[]; myUserId: string } | null> {
  const s = await connection;
  if (!s) return null;
  const { records } = await s.getTop(limit);
  return { records, myUserId: s.user.userId };
}

/** 포털이 iframe 높이를 게임 화면에 맞출 수 있게 내 높이를 알린다. */
export function reportHeight(el: HTMLElement) {
  if (!embedded || !ALLOWED_PLATFORMS.has(platformOrigin)) return;
  const post = () =>
    window.parent.postMessage(
      { channel: 'playhub.frame.v1', type: 'resize', height: Math.ceil(el.getBoundingClientRect().height) },
      platformOrigin,
    );
  new ResizeObserver(post).observe(el);
  post();
}

window.addEventListener('pagehide', () => sdk?.dispose());
