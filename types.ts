
export type ExperienceState = 
  | 'IDLE' 
  | 'LISTENING' 
  | 'COUNTDOWN' 
  | 'MORPH_CAKE' 
  | 'CANDLES_LIT' 
  | 'BLOW_OUT' 
  | 'GIFT_OPEN';

export interface GreetingData {
  message: string;
  author: string;
}
