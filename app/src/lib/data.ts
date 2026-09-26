import { USE_MOCKS } from './config';
import * as mock from './mock';
import * as real from './real';
const src = USE_MOCKS ? mock : real;
export const {
  signUp, signIn, signOut, getMyProfile, saveProfile, registerPushToken, verifyLocation,
  findMatches, getMatches, setMatchStatus,
  newWindowId, sendWindow, watchWindow, getToday, getWindow, saveWindow, getWall,
  watchInbox, sendKnock, getItinerary, reportUser,
  getTodayPrompt, getBond, getStamps, getPortrait,
  getPhysicalWindow, testPhysicalWindow,
} = src;
