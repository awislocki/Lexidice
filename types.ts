
export enum GameStatus {
  LOBBY = 'LOBBY',
  ROLLING = 'ROLLING',
  PLAYING = 'PLAYING',
  JUDGING = 'JUDGING',
  GAME_OVER = 'GAME_OVER'
}

export enum NetworkRole {
  HOST = 'HOST',
  GUEST = 'GUEST',
  LOCAL = 'LOCAL'
}

export interface Player {
  id: number;
  name: string;
  score: number;
  currentWord: string;
  lastWordScore: number;
  isReady: boolean;
  isCommitted: boolean;
}

export interface DiceLetter {
  id: string;
  letter: string;
  points: number;
}

export interface TurnResult {
  winnerId: number | 'tie' | null;
  explanation: string;
  p1Points: number;
  p2Points: number;
  p1WordValid: boolean;
  p2WordValid: boolean;
}

export interface NetworkMessage {
  type: 'SYNC_STATE' | 'UPDATE_WORD' | 'COMMIT_WORD' | 'START_GAME';
  payload: any;
}
