import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove, get } from 'firebase/database';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://demo-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export interface GameRoom {
  hostId: string;
  guestId?: string;
  status: string;
  players: any[];
  dice: any[];
  timeLeft: number;
  turnResult: any;
  isJudging: boolean;
  createdAt: number;
}

export class FirebaseGameSync {
  private roomId: string = '';
  private isHost: boolean = false;
  private onStateChange: ((data: any) => void) | null = null;

  createRoom(roomId: string, initialState: Partial<GameRoom>): Promise<void> {
    this.roomId = roomId;
    this.isHost = true;

    return set(ref(database, `rooms/${roomId}`), {
      ...initialState,
      hostId: roomId,
      createdAt: Date.now()
    });
  }

  async joinRoom(roomId: string): Promise<boolean> {
    this.roomId = roomId;
    this.isHost = false;

    // Check if room exists
    const roomRef = ref(database, `rooms/${roomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      console.error('Room does not exist');
      return false;
    }

    // Mark that guest has joined
    await update(roomRef, { guestId: 'guest-' + Date.now() });
    return true;
  }

  syncState(state: Partial<GameRoom>): Promise<void> {
    if (!this.roomId) {
      console.error('No room ID set');
      return Promise.resolve();
    }

    return update(ref(database, `rooms/${this.roomId}`), state);
  }

  listenToState(callback: (data: any) => void): void {
    if (!this.roomId) {
      console.error('No room ID set');
      return;
    }

    this.onStateChange = callback;
    const roomRef = ref(database, `rooms/${this.roomId}`);

    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data && this.onStateChange) {
        this.onStateChange(data);
      }
    });
  }

  async leaveRoom(): Promise<void> {
    if (!this.roomId) return;

    if (this.isHost) {
      // Host leaves - delete the room
      await remove(ref(database, `rooms/${this.roomId}`));
    } else {
      // Guest leaves - just clear guest ID
      await update(ref(database, `rooms/${this.roomId}`), { guestId: null });
    }

    this.roomId = '';
  }

  getIsHost(): boolean {
    return this.isHost;
  }
}
