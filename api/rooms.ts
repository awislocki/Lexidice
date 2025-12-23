import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Fallback to in-memory if KV not configured
const rooms = new Map<string, any>();
const useKV = !!process.env.KV_REST_API_URL;

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

  console.log(`[ROOMS API] ${method} request, roomId: ${roomId}`);
  console.log(`[ROOMS API] Using storage: ${useKV ? 'Vercel KV' : 'In-Memory (unreliable)'}`);

  try {
    switch (method) {
      case 'POST': {
        // Create new room
        const { roomId: newRoomId, initialState } = req.body;
        console.log(`[ROOMS API] Creating room: ${newRoomId}`);

        const roomData = {
          ...initialState,
          lastUpdate: Date.now(),
          hostConnected: true,
          guestConnected: false
        };

        if (useKV) {
          await kv.set(`room:${newRoomId}`, roomData, { ex: 1800 }); // 30 min expiry
          console.log(`[ROOMS API] Room saved to KV: ${newRoomId}`);
        } else {
          rooms.set(newRoomId, roomData);
          console.log(`[ROOMS API] Room saved to memory: ${newRoomId} (Total: ${rooms.size})`);
        }

        return res.status(200).json({ success: true, roomId: newRoomId });
      }

      case 'GET': {
        // Get room state
        if (!roomId || typeof roomId !== 'string') {
          console.log(`[ROOMS API] GET failed - no roomId provided`);
          return res.status(400).json({ error: 'Room ID required' });
        }

        let room;
        if (useKV) {
          room = await kv.get(`room:${roomId}`);
          console.log(`[ROOMS API] KV lookup for ${roomId}: ${room ? 'FOUND' : 'NOT FOUND'}`);
        } else {
          room = rooms.get(roomId);
          console.log(`[ROOMS API] Memory lookup for ${roomId}: ${room ? 'FOUND' : 'NOT FOUND'}`);
          console.log(`[ROOMS API] Available rooms in memory: ${Array.from(rooms.keys()).join(', ') || 'NONE'}`);
        }

        if (!room) {
          return res.status(404).json({ error: 'Room not found', storage: useKV ? 'kv' : 'memory' });
        }

        return res.status(200).json(room);
      }

      case 'PUT': {
        // Update room state
        if (!roomId || typeof roomId !== 'string') {
          return res.status(400).json({ error: 'Room ID required' });
        }

        let room;
        if (useKV) {
          room = await kv.get(`room:${roomId}`);
          console.log(`[ROOMS API] KV update lookup for ${roomId}: ${room ? 'FOUND' : 'NOT FOUND'}`);
        } else {
          room = rooms.get(roomId);
          console.log(`[ROOMS API] Memory update lookup for ${roomId}: ${room ? 'FOUND' : 'NOT FOUND'}`);
        }

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

        const updatedRoom = {
          ...room,
          ...state,
          players: mergedPlayers,
          lastUpdate: Date.now(),
          guestConnected: isGuest ? true : room.guestConnected
        };

        if (useKV) {
          await kv.set(`room:${roomId}`, updatedRoom, { ex: 1800 });
          console.log(`[ROOMS API] Room updated in KV: ${roomId}`);
        } else {
          rooms.set(roomId, updatedRoom);
          console.log(`[ROOMS API] Room updated in memory: ${roomId}`);
        }

        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        // Delete room
        if (!roomId || typeof roomId !== 'string') {
          return res.status(400).json({ error: 'Room ID required' });
        }

        if (useKV) {
          await kv.del(`room:${roomId}`);
          console.log(`[ROOMS API] Room deleted from KV: ${roomId}`);
        } else {
          rooms.delete(roomId);
          console.log(`[ROOMS API] Room deleted from memory: ${roomId}`);
        }

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
