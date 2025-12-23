
import React from 'react';

interface DiceIconProps {
  letter: string;
  points: number;
  delay?: number;
}

const DiceIcon: React.FC<DiceIconProps> = ({ letter, points, delay = 0 }) => {
  return (
    <div 
      className="dice-roll flex flex-col items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-white rounded-xl shadow-[0_6px_0_rgb(200,200,200),0_10px_20px_rgba(0,0,0,0.4)] border-2 border-slate-200 relative group transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-2xl md:text-3xl font-black text-slate-800 uppercase leading-none">{letter}</span>
      <span className="absolute bottom-1 right-1.5 text-[8px] md:text-[10px] font-bold text-slate-400">{points}</span>
      
      {/* Tactical Pips */}
      <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-slate-100 rounded-full"></div>
      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-slate-100 rounded-full"></div>
      <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-slate-100 rounded-full"></div>
      <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-slate-100 rounded-full"></div>
    </div>
  );
};

export default DiceIcon;
