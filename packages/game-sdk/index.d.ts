export type Player = { userId: string; displayName: string }
export type RankEntry = Player & { rank: number; score: number }
export type Ranking = { records: RankEntry[]; myRecord: RankEntry | null }
export class PlayHubError extends Error { code: string }
export interface PlayHub {
  readonly user: Readonly<Player>
  readonly gameId: string
  submitScore(score: number): Promise<void>
  getTop(limit?: number): Promise<Ranking>
  dispose(): void
}
export function connectPlayHub(options: { platformOrigin: string; timeoutMs?: number }): Promise<PlayHub>
