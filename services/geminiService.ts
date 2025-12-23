
import OpenAI from "openai";
import { TurnResult } from "../types";

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  dangerouslyAllowBrowser: true
});

export async function judgeWords(
  p1Name: string,
  p1Word: string,
  p2Name: string,
  p2Word: string,
  diceLetters: string[]
): Promise<TurnResult> {
  const userContent = `
    The current available letters (the dice pool) are: ${diceLetters.join(', ')}.

    Player 1 (${p1Name}) submitted: "${p1Word || 'nothing'}"
    Player 2 (${p2Name}) submitted: "${p2Word || 'nothing'}"

    CRITICAL RULES:
    1. A word is ONLY valid if it is a real English word AND can be constructed using the letters in the pool.
    2. If a letter appears twice in the pool, it can be used twice. If once, only once.
    3. SCORING:
       - Base score: Sum of Scrabble points for each letter.
       - Length Bonus: +2 per letter if the word is 5+ letters.
       - "Balderdash" Bonus: +5 if the word is rare/obscure but correctly spelled.

    Tasks:
    - Validate both words.
    - Calculate precise scores for both.
    - Determine a winner (the one with the highest score, or LexiMaster's choice if scores are close).
    - Provide a short, witty explanation.

    You must respond with a JSON object containing:
    - winnerId: 1 for player 1, 2 for player 2, 0 for tie/none
    - explanation: string with your witty judgment
    - p1Points: number of points for player 1
    - p2Points: number of points for player 2
    - p1WordValid: boolean
    - p2WordValid: boolean
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are the LexiMaster, a witty and slightly arrogant word game judge. You must evaluate the players' words and return the results strictly as JSON."
        },
        {
          role: "user",
          content: userContent
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const responseText = response.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("Empty response from AI");
    }

    const data = JSON.parse(responseText.trim());
    return {
      winnerId: data.winnerId === 0 ? 'tie' : data.winnerId,
      explanation: data.explanation,
      p1Points: data.p1Points,
      p2Points: data.p2Points,
      p1WordValid: data.p1WordValid,
      p2WordValid: data.p2WordValid
    };
  } catch (error) {
    console.error("OpenAI Error:", error);
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
