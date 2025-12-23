
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, Player, DiceLetter, TurnResult, NetworkRole, NetworkMessage } from './types';
import { LETTER_VALUES, VOWELS, CONSONANTS, MAX_SCORE, TURN_TIME } from './constants';
import { judgeWords } from './services/geminiService';
import DiceIcon from './components/DiceIcon';

const STORAGE_KEY = 'lexidice_state';

const FUNNY_WORDS = [
  'BANANA', 'PICKLE', 'WIGGLE', 'GIGGLE', 'BUMBLE', 'DOODLE', 'PUDDLE', 'SNOOZE', 
  'WOBBLE', 'NOODLE', 'MUFFIN', 'QUACKY', 'ZIGZAG', 'BUBBLE', 'SQUISH', 'CHEEKY', 
  'BAMBOO', 'POTATO', 'FLUFFY', 'PUFFIN', 'HIPHOP', 'TURTLE', 'TOMATO', 'KIBBLE',
  'NUGGET', 'RABBIT', 'SQUASH', 'TICKLE', 'YAMMER', 'GOOFED', 'JABBER', 'LOLLIE'
];

// --- SVG Icons ---
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);

const ScaleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/></svg>
);

const TrophyIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const LogoDiceLetter: React.FC<{ letter: string; color?: string; size?: string }> = ({ 
  letter, 
  color = "bg-indigo-600",
  size = "w-8 h-8 md:w-10 md:h-10"
}) => (
  <div className={`${size} ${color} rounded-lg flex items-center justify-center font-black text-white text-lg md:text-xl shadow-[inset_-2px_-3px_0_rgba(0,0,0,0.2),2px_4px_10px_rgba(0,0,0,0.5)] transform transition-transform relative border border-white/20 select-none group-hover:scale-110`}>
    {letter}
    <div className="absolute top-1 left-1 w-0.5 h-0.5 md:w-1 md:h-1 bg-white/30 rounded-full"></div>
    <div className="absolute top-1 right-1 w-0.5 h-0.5 md:w-1 md:h-1 bg-white/30 rounded-full"></div>
    <div className="absolute bottom-1 left-1 w-0.5 h-0.5 md:w-1 md:h-1 bg-white/30 rounded-full"></div>
    <div className="absolute bottom-1 right-1 w-0.5 h-0.5 md:w-1 md:h-1 bg-white/30 rounded-full"></div>
  </div>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOBBY);
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'Duelist A', score: 0, currentWord: '', lastWordScore: 0, isReady: false, isCommitted: false },
    { id: 2, name: 'Duelist B', score: 0, currentWord: '', lastWordScore: 0, isReady: false, isCommitted: false }
  ]);
  const [dice, setDice] = useState<DiceLetter[]>([]);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [turnResult, setTurnResult] = useState<TurnResult | null>(null);
  const [isJudging, setIsJudging] = useState(false);

  const [role, setRole] = useState<NetworkRole>(NetworkRole.LOCAL);
  const [peerId, setPeerId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveState = useCallback(() => {
    const data = { status, players, dice, timeLeft, turnResult, role, targetId, peerId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [status, players, dice, timeLeft, turnResult, role, targetId, peerId]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setStatus(parsed.status);
      setPlayers(parsed.players);
      setDice(parsed.dice);
      setTimeLeft(parsed.timeLeft);
      setTurnResult(parsed.turnResult);
      setRole(parsed.role);
      setTargetId(parsed.targetId || '');
      if (parsed.peerId) setPeerId(parsed.peerId);
    }
  }, []);

  useEffect(() => { saveState(); }, [saveState]);

  const generateFunnyId = () => FUNNY_WORDS[Math.floor(Math.random() * FUNNY_WORDS.length)];

  const setupPeer = useCallback((customId?: string) => {
    if (peerRef.current) peerRef.current.destroy();
    // @ts-ignore
    const peer = new window.Peer(customId);
    peerRef.current = peer;

    peer.on('open', (id: string) => {
      setPeerId(id);
      if (role === NetworkRole.GUEST && targetId) connectToHost(targetId);
    });

    peer.on('connection', (conn: any) => {
      if (role === NetworkRole.HOST) {
        connRef.current = conn;
        setIsConnected(true);
        setupConnectionListeners(conn);
        syncToGuest();
      }
    });

    peer.on('error', (err: any) => {
      if (err.type === 'unavailable-id') {
        const nextTry = generateFunnyId().substring(0, 4) + Math.floor(Math.random() * 89 + 10);
        setupPeer(nextTry);
      }
    });
    return peer;
  }, [role, targetId]);

  const startHosting = () => {
    setRole(NetworkRole.HOST);
    setupPeer(generateFunnyId());
  };

  const connectToHost = (id: string) => {
    if (!peerRef.current) {
        setupPeer();
        setTimeout(() => connectToHost(id), 500);
        return;
    }
    const cleanId = id.trim().toUpperCase();
    const conn = peerRef.current.connect(cleanId);
    connRef.current = conn;
    setTargetId(cleanId);
    setRole(NetworkRole.GUEST);
    setupConnectionListeners(conn);
  };

  const setupConnectionListeners = (conn: any) => {
    conn.on('open', () => setIsConnected(true));
    conn.on('data', (data: NetworkMessage) => handleNetworkMessage(data));
    conn.on('close', () => setIsConnected(false));
  };

  const syncToGuest = useCallback(() => {
    if (role === NetworkRole.HOST && connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'SYNC_STATE',
        payload: { status, players, dice, timeLeft, turnResult, isJudging }
      });
    }
  }, [role, status, players, dice, timeLeft, turnResult, isJudging]);

  const handleNetworkMessage = (msg: NetworkMessage) => {
    switch (msg.type) {
      case 'SYNC_STATE':
        setStatus(msg.payload.status);
        setPlayers(msg.payload.players);
        setDice(msg.payload.dice);
        setTimeLeft(msg.payload.timeLeft);
        setTurnResult(msg.payload.turnResult);
        setIsJudging(msg.payload.isJudging);
        break;
      case 'UPDATE_WORD':
        if (role === NetworkRole.HOST) {
          setPlayers(prev => prev.map(p => p.id === msg.payload.id ? { ...p, currentWord: msg.payload.word } : p));
        }
        break;
      case 'COMMIT_WORD':
        if (role === NetworkRole.HOST) {
          setPlayers(prev => prev.map(p => p.id === msg.payload.id ? { ...p, isCommitted: true } : p));
        }
        break;
    }
  };

  useEffect(() => { if (role === NetworkRole.LOCAL) setupPeer(); }, []);
  useEffect(() => { if (role === NetworkRole.HOST) syncToGuest(); }, [status, players, dice, timeLeft, turnResult, isJudging, role, syncToGuest]);

  const rollDice = useCallback(() => {
    const newDice: DiceLetter[] = [];
    for (let i = 0; i < 12; i++) {
      const isVowel = i < 3 || Math.random() > 0.65;
      const pool = isVowel ? VOWELS : CONSONANTS;
      const letter = pool[Math.floor(Math.random() * pool.length)];
      newDice.push({
        id: Math.random().toString(36).substr(2, 9),
        letter,
        points: LETTER_VALUES[letter] || 1
      });
    }
    setDice(newDice);
  }, []);

  const startGame = () => {
    if (role === NetworkRole.GUEST) return;
    setStatus(GameStatus.ROLLING);
    setTurnResult(null);
    setPlayers(prev => prev.map(p => ({ ...p, isCommitted: false, currentWord: '' })));
    rollDice();
    setTimeout(() => { setStatus(GameStatus.PLAYING); setTimeLeft(TURN_TIME); }, 1500);
  };

  const handleWordChange = (word: string) => {
    const myId = role === NetworkRole.GUEST ? 2 : 1;
    if (players.find(p => p.id === myId)?.isCommitted) return;
    if (role === NetworkRole.LOCAL || role === NetworkRole.HOST) {
      setPlayers(prev => prev.map(p => p.id === myId ? { ...p, currentWord: word.toUpperCase() } : p));
    } else {
      connRef.current?.send({ type: 'UPDATE_WORD', payload: { id: 2, word: word.toUpperCase() } });
      setPlayers(prev => prev.map(p => p.id === 2 ? { ...p, currentWord: word.toUpperCase() } : p));
    }
  };

  const handleCommit = () => {
    const myId = role === NetworkRole.GUEST ? 2 : 1;
    if (role === NetworkRole.LOCAL || role === NetworkRole.HOST) {
      setPlayers(prev => prev.map(p => p.id === myId ? { ...p, isCommitted: true } : p));
    } else {
      connRef.current?.send({ type: 'COMMIT_WORD', payload: { id: 2 } });
      setPlayers(prev => prev.map(p => p.id === 2 ? { ...p, isCommitted: true } : p));
    }
  };

  const submitTurn = useCallback(async (currentPlayers: Player[]) => {
    if (status !== GameStatus.PLAYING || isJudging) return;
    setIsJudging(true);
    setStatus(GameStatus.JUDGING);
    if (timerRef.current) clearInterval(timerRef.current);
    const result = await judgeWords(currentPlayers[0].name, currentPlayers[0].currentWord, currentPlayers[1].name, currentPlayers[1].currentWord, dice.map(d => d.letter));
    setTurnResult(result);
    setPlayers(prev => prev.map(p => {
      const turnPoints = p.id === 1 ? result.p1Points : result.p2Points;
      const newTotal = p.score + turnPoints;
      // Win condition check happens in the useEffect usually, but we update score here
      return { ...p, score: newTotal, lastWordScore: turnPoints, isCommitted: false };
    }));
    setIsJudging(false);
  }, [dice, status, isJudging]);

  useEffect(() => {
    if (role !== NetworkRole.GUEST && status === GameStatus.PLAYING) {
      if (players.every(p => p.isCommitted)) submitTurn(players);
    }
  }, [players, status, submitTurn, role]);

  useEffect(() => {
    if (role !== NetworkRole.GUEST && status === GameStatus.PLAYING) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { submitTurn(players); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current as any); };
  }, [status, role, submitTurn, players]);

  useEffect(() => {
    if (players.some(p => p.score >= MAX_SCORE) && status === GameStatus.JUDGING && !isJudging) {
      setStatus(GameStatus.GAME_OVER);
    }
  }, [players, status, isJudging]);

  const renderLobby = () => (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col items-center">
        <div className="flex gap-1 md:gap-2 mb-6">
          {"LEXI".split('').map((l, i) => <LogoDiceLetter key={`lexi-${i}`} letter={l} color="bg-indigo-600" size="w-10 h-10 md:w-16 md:h-16" />)}
          <div className="w-2 md:w-4"></div>
          {"DICE".split('').map((l, i) => <LogoDiceLetter key={`dice-${i}`} letter={l} color="bg-pink-600" size="w-10 h-10 md:w-16 md:h-16" />)}
        </div>
        <div className="inline-block bg-indigo-600/20 text-indigo-400 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-indigo-500/30">
          {isConnected ? 'LIVE CONNECTION' : 'P2P MULTIPLAYER'}
        </div>
      </div>

      <div className="flex flex-col items-center space-y-8 w-full max-w-2xl px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {players.map(p => {
            const isMe = (role === NetworkRole.HOST && p.id === 1) || (role === NetworkRole.GUEST && p.id === 2) || role === NetworkRole.LOCAL;
            return (
              <div key={p.id} className={`bg-slate-800/40 p-5 rounded-3xl border transition-all ${isMe ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'border-slate-700 opacity-60'}`}>
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-3 tracking-widest">{p.id === 1 ? 'Alpha' : 'Beta'} {isMe && '(You)'}</h3>
                <input 
                  disabled={!isMe}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xl font-black focus:ring-4 ring-indigo-500/50 outline-none transition-all placeholder:text-slate-800"
                  value={p.name}
                  onChange={(e) => setPlayers(prev => prev.map(pl => pl.id === p.id ? { ...pl, name: e.target.value } : pl))}
                  placeholder="Player Name"
                />
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900/80 p-8 rounded-[2.5rem] border border-slate-700 w-full space-y-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-pink-500"></div>
          {role === NetworkRole.LOCAL ? (
            <div className="flex flex-col md:flex-row gap-4">
              <button onClick={startHosting} className="flex-1 py-4 bg-indigo-600 rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-lg active:scale-95 text-sm uppercase tracking-widest">HOST DUEL</button>
              <button onClick={() => setRole(NetworkRole.GUEST)} className="flex-1 py-4 bg-slate-800 rounded-2xl font-black hover:bg-slate-700 transition-all border border-slate-600 active:scale-95 text-sm uppercase tracking-widest">JOIN DUEL</button>
            </div>
          ) : role === NetworkRole.HOST ? (
            <div className="space-y-4">
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Share Your Secret Key</div>
              <div className="flex items-center gap-3">
                <div className="flex-grow bg-black/50 p-5 rounded-2xl font-black text-3xl text-center border-2 border-indigo-500/50 text-white tracking-[0.2em] shadow-inner">
                  {peerId || 'ROLLING...'}
                </div>
                <button onClick={() => navigator.clipboard.writeText(peerId)} className="p-5 bg-slate-800 rounded-2xl hover:bg-slate-700 text-white transition-colors"><CopyIcon /></button>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {isConnected ? 'Connection established' : 'Searching for challenger...'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-[10px] font-black text-pink-400 uppercase tracking-[0.3em]">Enter Challenger's Key</div>
              <div className="flex gap-2">
                <input 
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value.toUpperCase())}
                  className="flex-grow bg-black/50 p-5 rounded-2xl font-black text-3xl text-center border-2 border-slate-700 outline-none focus:border-pink-500 tracking-[0.2em] text-white uppercase"
                  placeholder="KEY..."
                />
                <button onClick={() => connectToHost(targetId)} className="px-10 bg-pink-600 rounded-2xl font-black hover:bg-pink-500 transition-all shadow-lg active:scale-95"><CheckIcon /></button>
              </div>
              <button onClick={() => setRole(NetworkRole.LOCAL)} className="text-[10px] font-black text-slate-600 hover:text-white underline tracking-widest uppercase">Go Back</button>
            </div>
          )}
        </div>

        <button 
          disabled={role !== NetworkRole.LOCAL && !isConnected}
          onClick={startGame}
          className="w-full py-6 bg-white text-slate-950 rounded-[2rem] font-black text-3xl shadow-[0_10px_30px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:grayscale uppercase tracking-tighter"
        >
          {role === NetworkRole.GUEST ? 'Waiting for Host' : 'Commence Battle'}
        </button>
      </div>
    </div>
  );

  const renderGameBoard = () => {
    const myId = role === NetworkRole.GUEST ? 2 : 1;
    return (
      <div className="flex flex-col items-center w-full max-w-5xl mx-auto space-y-10 pt-4 pb-20 animate-in zoom-in-95 duration-500">
        <div className="grid grid-cols-3 w-full items-center bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col items-start px-6">
              <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${myId === 1 ? 'text-indigo-400' : 'text-slate-500'}`}>{players[0].name}</span>
              <span className="text-5xl font-black text-white">{players[0].score}</span>
          </div>
          <div className="flex flex-col items-center">
              <div className={`w-24 h-24 rounded-[2rem] border-4 ${timeLeft < 10 ? 'border-red-500 text-red-500 animate-pulse' : 'border-indigo-500 text-white'} flex flex-col items-center justify-center bg-slate-950 shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)]`}>
                  <span className="text-[10px] font-black uppercase opacity-40 tracking-tighter">TIME</span>
                  <span className="text-4xl font-black leading-none">{timeLeft}</span>
              </div>
          </div>
          <div className="flex flex-col items-end px-6">
              <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${myId === 2 ? 'text-pink-400' : 'text-slate-500'}`}>{players[1].name}</span>
              <span className="text-5xl font-black text-white">{players[1].score}</span>
          </div>
        </div>

        <div className="relative p-10 bg-slate-800/20 rounded-[3rem] border-2 border-slate-700/50 backdrop-blur-sm w-full shadow-inner">
          <div className="flex flex-wrap justify-center gap-5 md:gap-7">
            {dice.map((d, i) => <DiceIcon key={d.id} letter={d.letter} points={d.points} delay={i * 80} />)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full px-4">
          {players.map((p, idx) => {
            const isMe = (p.id === myId);
            return (
              <div key={p.id} className={`group flex flex-col space-y-6 p-8 rounded-[3rem] border-2 transition-all ${p.isCommitted ? 'bg-green-500/10 border-green-500/50' : idx === 0 ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-pink-500/30 bg-pink-500/5'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`text-2xl font-black ${idx === 0 ? 'text-indigo-400' : 'text-pink-400'}`}>{p.name} {isMe && '(YOU)'}</h3>
                    {p.isCommitted && <div className="flex items-center gap-2 bg-green-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase animate-bounce"><CheckIcon /> <span>Locked</span></div>}
                </div>
                <input 
                  disabled={!isMe || p.isCommitted || status !== GameStatus.PLAYING}
                  autoFocus={isMe}
                  className={`w-full bg-slate-950 border-2 rounded-2xl p-6 text-center text-4xl font-black uppercase tracking-[0.2em] outline-none transition-all ${!isMe ? 'opacity-30 cursor-not-allowed border-transparent' : p.isCommitted ? 'border-green-500/50 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'border-slate-800 focus:border-white'}`}
                  placeholder={isMe ? "ENTER WORD" : "..."}
                  value={p.currentWord}
                  onChange={(e) => handleWordChange(e.target.value)}
                />
                {isMe && (
                  <button 
                    disabled={p.isCommitted || !p.currentWord || status !== GameStatus.PLAYING}
                    onClick={handleCommit}
                    className={`w-full py-5 rounded-2xl font-black text-2xl transition-all shadow-xl ${p.isCommitted ? 'bg-green-600 text-white cursor-default' : 'bg-slate-800 text-slate-300 hover:bg-white hover:text-black active:scale-95 uppercase tracking-widest'}`}
                  >
                    {p.isCommitted ? 'WORD LOCKED' : 'COMMIT WORD'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderJudging = () => (
    <div className="flex flex-col items-center justify-center min-h-[75vh] w-full max-w-4xl mx-auto space-y-12 p-8 animate-in fade-in zoom-in-95">
      <h2 className="text-5xl md:text-7xl bungee text-indigo-400 text-center leading-tight">
        {isJudging ? 'The Master Judgeth' : 'The Verdict'}
      </h2>
      {isJudging ? (
        <div className="flex flex-col items-center space-y-10 text-center">
            <ScaleIcon className="text-indigo-500 animate-[spin_4s_linear_infinite]" />
            <div className="space-y-2">
              <p className="text-2xl text-slate-400 font-bold italic">"Scanning ancient lexicons..."</p>
              <div className="flex gap-1 justify-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
        </div>
      ) : turnResult && (
        <div className="w-full space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {players.map((p) => (
              <div key={p.id} className={`bg-slate-900 p-8 rounded-[2.5rem] border-4 ${p.id === 1 ? 'border-indigo-500' : 'border-pink-500'} shadow-2xl relative overflow-hidden`}>
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-4xl font-black opacity-10">#{p.id}</div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-[0.3em]">{p.name}</h3>
                <div className="text-5xl font-black mb-6 tracking-widest text-white">{p.currentWord || '—'}</div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-6">
                    <span className={`text-2xl font-black ${p.id === 1 ? (turnResult.p1WordValid ? 'text-green-400' : 'text-red-500') : (turnResult.p2WordValid ? 'text-green-400' : 'text-red-500')}`}>
                        {p.id === 1 ? (turnResult.p1WordValid ? 'VALID' : 'INVALID') : (turnResult.p2WordValid ? 'VALID' : 'INVALID')}
                    </span>
                    <span className="text-4xl font-black text-white bg-slate-800 px-4 py-1 rounded-xl">+{p.id === 1 ? turnResult.p1Points : turnResult.p2Points}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-slate-800/40 p-12 rounded-[3.5rem] border border-slate-700 backdrop-blur-lg text-center shadow-2xl relative">
             <div className="text-2xl font-bold text-indigo-300 mb-10 italic leading-relaxed max-w-2xl mx-auto">"{turnResult.explanation}"</div>
             {role !== NetworkRole.GUEST && (
               <button onClick={startGame} className="px-16 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl transition-all shadow-xl active:scale-95 uppercase tracking-widest">Next Duel</button>
             )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#030712] text-slate-50 p-4 md:p-8 selection:bg-indigo-500 selection:text-white">
      <nav className="flex items-center justify-between mb-8 max-w-6xl mx-auto border-b border-slate-800 pb-6">
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => { if(window.confirm('Abandon this duel?')) { localStorage.clear(); window.location.reload(); } }}>
          <div className="flex gap-1 items-center">
            <LogoDiceLetter letter="L" color="bg-indigo-600" size="w-8 h-8 md:w-10 md:h-10" />
            <LogoDiceLetter letter="D" color="bg-pink-600" size="w-8 h-8 md:w-10 md:h-10" />
          </div>
          <div className="flex flex-col ml-1">
            <span className="font-black tracking-tighter text-xl leading-none">LEXIDICE</span>
            <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.4em]">Multiplayer v3.1</span>
          </div>
        </div>
        <div className="flex gap-4 bg-slate-900/80 px-5 py-2.5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-700'}`}></div>
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isConnected ? 'text-green-500' : 'text-slate-500'}`}>
              {role === NetworkRole.LOCAL ? 'OFFLINE MODE' : isConnected ? 'NETWORK STABLE' : 'LINKING...'}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto">
        {status === GameStatus.LOBBY && renderLobby()}
        {(status === GameStatus.ROLLING || status === GameStatus.PLAYING) && renderGameBoard()}
        {status === GameStatus.JUDGING && renderJudging()}
        {status === GameStatus.GAME_OVER && (
          <div className="flex flex-col items-center justify-center text-center space-y-12 py-20 animate-in fade-in zoom-in-90 duration-700">
             <div className="relative">
                <h1 className="text-[10rem] md:text-[14rem] font-black text-white/5 absolute -top-24 left-1/2 -translate-x-1/2 select-none">DUEL</h1>
                <h1 className="text-7xl md:text-9xl bungee text-yellow-400">FINIS</h1>
             </div>
             <div className="bg-slate-900/80 p-16 rounded-[4rem] border-8 border-indigo-600 shadow-[0_0_100px_rgba(79,70,229,0.2)] relative backdrop-blur-xl flex flex-col items-center">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-2 rounded-full font-black uppercase text-sm tracking-[0.3em]">SUPREME VICTOR</div>
                <TrophyIcon className="text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.4)]" />
                <div className="text-7xl md:text-8xl font-black text-white tracking-tighter mb-4">
                    {players[0].score > players[1].score ? players[0].name : players[1].name}
                </div>
                <div className="text-4xl font-black text-indigo-400 tracking-[0.2em] uppercase">{Math.max(players[0].score, players[1].score)} TOTAL PTS</div>
             </div>
             {role !== NetworkRole.GUEST && (
               <button onClick={startGame} className="px-24 py-8 bg-white text-slate-950 rounded-[2.5rem] font-black text-4xl hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-95 uppercase tracking-tighter">New Duel</button>
             )}
          </div>
        )}
      </main>
      
      <footer className="mt-32 mb-10 flex flex-col items-center opacity-10 grayscale hover:grayscale-0 hover:opacity-50 transition-all cursor-default">
        <div className="flex gap-2 mb-4">
           {"LEXIDICE".split('').map((l, i) => <div key={`footer-${i}`} className="w-4 h-4 bg-white/20 rounded-sm flex items-center justify-center text-[8px] font-black">{l}</div>)}
        </div>
        <span className="text-[8px] uppercase font-black tracking-[1em]">Protocol Layer 2.7.5</span>
      </footer>
    </div>
  );
};

export default App;
