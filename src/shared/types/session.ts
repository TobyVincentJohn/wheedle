export interface GameSession {
  sessionId: string;
  sessionCode: string;
  hostUserId: string;
  hostUsername: string;
  players: SessionPlayer[];
  status: 'waiting' | 'countdown' | 'in-game' | 'completed';
  createdAt: number;
  maxPlayers: number;
  gameStartedAt?: number;
  countdownStartedAt?: number; // When the 10-second countdown began
  dealerId?: number; // Dealer image ID for consistency across all players
  isPrivate?: boolean; // Whether this is a private session
  prizePool: number; // Total money in the prize pool
  entryFee: number; // Entry fee per player (default 100)
  minimumBet: number; // Minimum bet per round (default 10)
}

export interface SessionPlayer {
  userId: string;
  username: string;
  joinedAt: number;
  isHost: boolean;
  moneyCommitted: number; // Money this player has committed to the session
  hasPlacedMinimumBet: boolean; // Whether player has placed the minimum bet
}

export interface CreateSessionRequest {
  maxPlayers?: number;
}

export interface CreateSessionResponse {
  status: 'success' | 'error';
  message?: string;
  data?: GameSession;
}

export interface JoinSessionRequest {
  sessionId: string;
}

export interface JoinSessionResponse {
  status: 'success' | 'error';
  message?: string;
  data?: GameSession;
  userMoney?: number;
}

export interface GetPublicSessionsResponse {
  status: 'success' | 'error';
  message?: string;
  data?: GameSession[];
}

export interface LeaveSessionResponse {
  status: 'success' | 'error';
  message?: string;
  moneyReturned?: number;
}

export interface StartCountdownResponse {
  status: 'success' | 'error';
  message?: string;
  data?: GameSession;
}