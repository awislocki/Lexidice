import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory storage (will reset on cold starts, but good enough for demo)
const rooms = new Map<string, any>();

// Auto-cleanup old rooms (older than 30 minutes)
const cleanupOldRooms = () => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastUpdate > 30 * 60 * 1000) {
      rooms.delete(roomId);
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  cleanupOldRooms();

  const { method } = req;
  const { roomId } = req.query;

  try {
    switch (method) {
      case 'POST': {
        // Create new room
        const { roomId: newRoomId, initialState } = req.body;
        rooms.set(newRoomId, {
          ...initialState,
          lastUpdate: Date.now(),
          hostConnected: true,
          guestConnected: false
        });
        return res.status(200).json({ success: true, roomId: newRoomId });
      }

      case 'GET': {
        // Get room state
        if (!roomId || typeof roomId !== 'string') {
          return res.status(400).json({ error: 'Room ID required' });
        }
        const room = rooms.get(roomId);
        if (!room) {
          return res.status(404).json({ error: 'Room not found' });
        }
        return res.status(200).json(room);
      }

      case 'PUT': {
        // Update room state
        if (!roomId || typeof roomId !== 'string') {
          return res.status(400).json({ error: 'Room ID required' });
        }
        const room = rooms.get(roomId);
        if (!room) {
          return res.status(404).json({ error: 'Room not found' });
        }
        const { state, isGuest } = req.body;

        // Merge players array intelligently
        let mergedPlayers = room.players || [];
        if (state.players && Array.isArray(state.players)) {
          mergedPlayers = room.players.map((p: any, idx: number) => {
            // Guest (player 2, index 1) can only update their own data
            // Host (player 1, index 0) can update their own data
            if (isGuest && idx === 1) {
              return { ...p, ...state.players[idx] };
            } else if (!isGuest && idx === 0) {
              return { ...p, ...state.players[idx] };
            }
            return p;
          });
        }

        rooms.set(roomId, {
          ...room,
          ...state,
          players: mergedPlayers,
          lastUpdate: Date.now(),
          guestConnected: isGuest ? true : room.guestConnected
        });
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        // Delete room
        if (!roomId || typeof roomId !== 'string') {
          return res.status(400).json({ error: 'Room ID required' });
        }
        rooms.delete(roomId);
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Room API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
