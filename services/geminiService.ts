import { TurnResult } from "../types";

export async function judgeWords(
  p1Name: string,
  p1Word: string,
  p2Name: string,
  p2Word: string,
  diceLetters: string[]
): Promise<TurnResult> {
  try {
    const response = await fetch('/api/judge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p1Name,
        p1Word,
        p2Name,
        p2Word,
        diceLetters
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Handle fallback response from server
    if (data.fallback) {
      return data.fallback;
    }

    return data;
  } catch (error) {
    console.error("Judge API Error:", error);
    return {
      winnerId: 'tie',
      explanation: "The LexiMaster is temporarily unavailable. Local scoring fallback applied.",
      p1Points: 0,
      p2Points: 0,
      p1WordValid: true,
      p2WordValid: true
    };
  }
}
