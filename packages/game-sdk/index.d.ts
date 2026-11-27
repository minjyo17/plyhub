export type Player = { userId: string; displayName: string }
export type RankEntry = Player & { rank: number; score: number }
export type Ranking = { records: RankEntry[]; myRecord: RankEntry | null }
export class PlayHubError extends Error { code: string }
export interface Room {
  readonly code: string
  /** 나를 뺀, 지금 방에 있는 사람들 */
  readonly others: Player[]
  readonly closed: boolean
  /** 방의 다른 사람 모두에게 보낸다. 4,096자 이하로 직렬화되는 JSON 객체만 된다. */
  send(data: object): Promise<void>
  leave(): Promise<void>
  /** 받은 데이터는 상대 게임이 보낸 값이라 믿지 말고 검사해서 쓴다. */
  onMessage(listener: (data: unknown, from: Player) => void): () => void
  onPlayers(listener: (change: { joined: Player[]; left: Player[] }) => void): () => void
  /** 연결이 끊기거나 leave()로 나가면 한 번 불린다. */
  onClose(listener: () => void): () => void
}
export interface PlayHub {
  readonly user: Readonly<Player>
  readonly gameId: string
  submitScore(score: number): Promise<void>
  getTop(limit?: number): Promise<Ranking>
  /** 같은 게임에서 같은 코드(영문 대문자·숫자 4~12자)로 들어온 사람끼리 같은 방이 된다. 방은 한 번에 하나. */
  joinRoom(code: string): Promise<Room>
  dispose(): void
}
export function connectPlayHub(options: { platformOrigin: string; timeoutMs?: number }): Promise<PlayHub>
