export interface RoomState {
  status: string;
  players: any[];
  dice: any[];
  timeLeft: number;
  turnResult: any;
  isJudging: boolean;
}

export class RoomService {
  private roomId: string = '';
  private isHost: boolean = false;
  private pollInterval: any = null;
  private onStateChange: ((state: RoomState) => void) | null = null;

  async createRoom(roomId: string, initialState: RoomState): Promise<boolean> {
    try {
      console.log('🎲 Creating room:', roomId);
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, initialState })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to create room:', errorText);
        return false;
      }

      const result = await response.json();
      console.log('✅ Room created successfully:', result);

      this.roomId = roomId;
      this.isHost = true;
      console.log('✅ Room ID set:', roomId);
      return true;
    } catch (error) {
      console.error('❌ Create room error:', error);
      return false;
    }
  }

  async joinRoom(roomId: string): Promise<boolean> {
    try {
      console.log('🔍 Looking for room:', roomId);
      const response = await fetch(`/api/rooms?roomId=${roomId}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Room not found:', errorText);
        return false;
      }

      const roomData = await response.json();
      console.log('✅ Room found:', roomData);

      this.roomId = roomId;
      this.isHost = false;

      // Mark guest as connected with retry
      let retries = 3;
      while (retries > 0) {
        try {
          await this.updateState({} as RoomState, true);
          console.log('✅ Guest marked as connected');
          break;
        } catch (err) {
          retries--;
          console.log(`⚠️ Failed to mark connected, retries left: ${retries}`);
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log('✅ Joined room:', roomId);
      return true;
    } catch (error) {
      console.error('❌ Join room error:', error);
      return false;
    }
  }

  async updateState(state: Partial<RoomState>, isGuest: boolean = false): Promise<void> {
    if (!this.roomId) return;

    try {
      await fetch(`/api/rooms?roomId=${this.roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, isGuest })
      });
    } catch (error) {
      console.error('Update state error:', error);
    }
  }

  startPolling(callback: (state: RoomState) => void, intervalMs: number = 500): void {
    if (!this.roomId) {
      console.error('No room ID set');
      return;
    }

    this.onStateChange = callback;

    // Poll for updates
    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/rooms?roomId=${this.roomId}`);
        if (response.ok) {
          const data = await response.json();
          if (this.onStateChange) {
            this.onStateChange(data);
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, intervalMs);

    console.log('📡 Started polling for room updates');
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('📡 Stopped polling');
    }
  }

  async leaveRoom(): Promise<void> {
    this.stopPolling();

    if (!this.roomId) return;

    if (this.isHost) {
      // Host leaves - delete room
      try {
        await fetch(`/api/rooms?roomId=${this.roomId}`, {
          method: 'DELETE'
        });
        console.log('🗑️ Room deleted');
      } catch (error) {
        console.error('Delete room error:', error);
      }
    }

    this.roomId = '';
  }

  getIsHost(): boolean {
    return this.isHost;
  }

  getRoomId(): string {
    return this.roomId;
  }
}
