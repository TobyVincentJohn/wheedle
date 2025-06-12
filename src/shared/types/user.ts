export interface UserDetails {
  userId: string;
  username: string;
  lastActive: number;
  currentRoom?: string;
  score?: number;
  money: number; // User's total money balance
  moneyInHand?: number; // Money currently committed to a game session
} 