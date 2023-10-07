const axios = require("axios");
const uuid = require("uuid");
const exampleDungeon = require('./example_dungeon.json');

const sessionDungeons = {};
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function constructDungeon(playerNumber, playerLevel) {
  const sessionId = uuid.v4();
  const prompt =
    `Please create a dungeons & dragons fifth edition dungeon suitable for ${playerNumber} players of level ${playerLevel}. Provide details in a structured JSON format: EVERYTHING IN YOUR RESPONSE SHOULD BE IN JSON FORMAT. Pay careful attention to the provided number of players (partySize ${playerNumber} in the JSON) and player level (level ${playerLevel} in the JSON)`;

  const payload = {
    model: "gpt-3.5-turbo-16k-0613",
    messages: [
      {
        role: "system",
        content:
          `Construct a D&D 5e dungeon for a game. You will be used to generate assets for the game. It should be suitable for ${playerNumber} players of level ${playerLevel}. Here's an example format: ${JSON.stringify(exampleDungeon)}`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  let response;
  try {
    response = await axios.post(OPENAI_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }

  let dungeon;
  try {
      dungeon = JSON.parse(response.data.choices[0]?.message?.content);
  } catch (error) {
      console.error("Error parsing dungeon JSON:", error);
      dungeon = {};
  }

  sessionDungeons[sessionId] = dungeon;

  return [dungeon, sessionId];
}

async function startTheAdventure(dungeon, sessionId, playerNumber, playerLevel) {
    const systemInstruction = "You are a dungeon master introducing players to the start of a grand adventure. Provide a detailed and immersive description of the dungeon entrance, setting the scene and atmosphere, and drawing the players into the story. Use the dungeon's provided JSON details to create a rich and engaging narrative. At the end of your description, ask what the players would like to do.";

    const payload = {
        model: "gpt-3.5-turbo-16k-0613",
        messages: [
            {
                role: "system",
                content: systemInstruction
            },
            {
                role: "user",
                content: `The adventure begins now! Here is the dungeon the (${playerNumber} level ${playerLevel}) players will be exploring: ${JSON.stringify(dungeon)}. Describe its entrance in detail, and then ask the players what they do next.`
            }
        ]
    };

    let response;
    try {
        response = await axios.post(OPENAI_API_URL, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        });
    } catch (error) {
        console.error("Error calling OpenAI API for starting the adventure:", error);
        throw error;
    }

    const detailedDescription = response.data.choices[0]?.message?.content;

    return {
        response: detailedDescription,
        sessionId,
        dungeon,
    };
}

function getDungeonBySessionId(sessionId) {
    return sessionDungeons[sessionId];
}

async function processPlayerResponse(playerResponse, sessionId) {
    const currentDungeonState = getDungeonBySessionId(sessionId);
    if (!currentDungeonState) {
        throw new Error("Session not found!");
    }

    const systemInstruction = "You are a dungeon master guiding players through a dungeon which is represented in a JSON object. Your response to this prompt should ONLY be in a JSON object (formatted this way - {response:'', dungeon: {}), with no invalid data. Take in their prompt, observe the state of the dungeon, and then modify the dungeon state accordingly and respond with it. In the JSON object you respond with, you should include a 'response' in the JSON object representing your narration to the players.";

    const payload = {
        model: "gpt-3.5-turbo-16k-0613",
        messages: [
            {
                role: "system",
                content: systemInstruction
            },
            {
                role: "user",
                content: `Player's action: "${playerResponse}". Current dungeon state: ${JSON.stringify(currentDungeonState)}. Update the dungeon JSON and respond ONLY with JSON, no other characters as we are using your JSON response directly. When a room has been visited, for example - change 'visited' to true. If the enemies in that room are defeated, change enemiesDefeated to 'true' e.g. - always end your response with a hook, narrating how an enemy might respond, or bring the players' attention back to their available options.`
            }
        ]
    };

    let response;
    try {
        response = await axios.post(OPENAI_API_URL, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        });
    } catch (error) {
        console.error("Error calling OpenAI API for player response:", error);
        throw error;
    }

    const res = response.data.choices[0]?.message?.content;

    sessionDungeons[sessionId] = JSON.parse(res).dungeon;
    const updatedDungeon = JSON.parse(res).dungeon;
    const narrativeResponse = JSON.parse(res).response;

    return {
        response: narrativeResponse,
        sessionId,
        updatedDungeonState: updatedDungeon
    };
}

/* Existing code... */

module.exports = {
  constructDungeon,
  startTheAdventure,
  getDungeonBySessionId,
  processPlayerResponse
};