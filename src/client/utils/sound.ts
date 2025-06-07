// Cache audio objects to avoid recreating them
const audioCache: { [key: string]: HTMLAudioElement } = {};

// Import sound files
const HOVER_SOUND = new URL('../../../assets/sounds/hover.mp3', import.meta.url).href;
const CLICK_SOUND = new URL('../../../assets/sounds/click.mp3', import.meta.url).href;

// Initialize sounds by preloading them
const initSounds = () => {
  if (!audioCache[HOVER_SOUND]) {
    audioCache[HOVER_SOUND] = new Audio(HOVER_SOUND);
    audioCache[HOVER_SOUND].volume = 0.2;
  }
  if (!audioCache[CLICK_SOUND]) {
    audioCache[CLICK_SOUND] = new Audio(CLICK_SOUND);
    audioCache[CLICK_SOUND].volume = 1;
  }
};

// Sound state management - start with sound disabled
let isSoundEnabled = false;

export const toggleSound = () => {
  isSoundEnabled = !isSoundEnabled;
  return isSoundEnabled;
};

export const getSoundState = () => isSoundEnabled;

export const enableSound = () => {
  isSoundEnabled = true;
  return isSoundEnabled;
};

export const disableSound = () => {
  isSoundEnabled = false;
  return isSoundEnabled;
};

const playSound = (soundUrl: string) => {
  if (!isSoundEnabled) return;

  try {
    // Create or get cached audio object
    if (!audioCache[soundUrl]) {
      audioCache[soundUrl] = new Audio(soundUrl);
      audioCache[soundUrl].volume = soundUrl === HOVER_SOUND ? 0.2 : 1;
    }

    const audio = audioCache[soundUrl];
    // Reset and play
    audio.currentTime = 0;
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error('Audio play failed:', error);
      });
    }
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

// Initialize sounds when this module loads
initSounds();

export const playHoverSound = () => playSound(HOVER_SOUND);
export const playClickSound = () => playSound(CLICK_SOUND); 