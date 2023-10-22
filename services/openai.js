const axios = require("axios");
const uuid = require("uuid");
const exampleDungeon = require("./example_dungeon.json");

const sessionDungeons = {};
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function constructDungeon(playerName) {
  const sessionId = uuid.v4();
  const prompt = `Please create a text-based adventure dungeon with the theme of an ancient, mysterious location. The player exploring the dungeon goes by the name ${playerName}. Provide details in a structured JSON format: EVERYTHING IN YOUR RESPONSE SHOULD BE IN JSON FORMAT. The details should be based on the character name provided (player "name" ${playerName} in the JSON).`;

  const payload = {
    model: "gpt-3.5-turbo-16k-0613",
    messages: [
      {
        role: "system",
        content: `Construct a text-based adventure dungeon in a structured JSON format. This will be used to facilitate a narrative-driven game in a classic text adventure style. You will be generating the assets for this game, and the dungeon should be designed around the character named ${playerName}. 

        Consider the following when generating the dungeon:
        
        1. **Dungeon Theme**: The environment should be rich in lore, providing an engaging backdrop for the narrative. Consider themes like ancient ruins, haunted mansions, or hidden temples.
        
        2. **Narrative Integration**: The character's name, ${playerName}, can be used to seed narrative elements that make the dungeon personally significant to them. For instance, perhaps they're exploring a mansion once owned by their ancestors.
        
        3. **Room Descriptions**: Each room should have a detailed description. This description provides the primary interaction for the player, so it needs to be atmospheric, descriptive, and clear.
        
        4. **Interactable Items**: Include items that the player can find, use, or interact with. These items can provide clues, solutions to puzzles, or simply add depth to the narrative.
        
        5. **Exits and Navigation**: Clearly define exits for each room and specify the direction (e.g., 'north', 'south', etc.). The layout should be logically consistent, allowing the player to build a mental map as they navigate.
        
        6. **Encounters and Events**: While this is not a combat-focused game, feel free to include encounters or events. These can be mysterious happenings, environmental challenges, or non-player character interactions.
        
        7. **Bot Only Notes**: Include hidden details, hints, and possible actions specific to each room under the "for_bot_only_notes" key. This will allow for dynamic storytelling and help guide the player when needed.
        
        8. **Player's Interaction History**: Maintain a record for each room with "player_history_with_room", capturing the player's actions and decisions in that room.
        
        Here's an example of the desired JSON format: ${JSON.stringify(
          exampleDungeon
        )}`,
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

async function startTheAdventure(dungeon, sessionId, playerName) {
  const systemInstruction = `You are the guiding voice narrating a text-based adventure for the player named ${playerName}. Your objective is to immerse them in the narrative and make them feel a part of the world you describe. Begin by detailing the entrance of the dungeon using the information provided in the JSON format. Create a vivid and atmospheric scene that not only describes the physical surroundings but also captures the emotions, ambiance, and hidden mysteries of the location. Make use of sensory details, hinting at sounds, smells, and even the temperature if relevant. As you finish setting the scene, gently prompt ${playerName} by asking what they would like to do next, encouraging exploration and interaction within the story. Try to use neutral gender pronouns.`;

  const payload = {
    model: "gpt-3.5-turbo-16k-0613",
    messages: [
      {
        role: "system",
        content: systemInstruction,
      },
      {
        role: "user",
        content: `The adventure begins now! This is the mysterious location ${playerName} will be exploring: ${JSON.stringify(
          dungeon
        )}. Immerse ${playerName} in the story by vividly describing the entrance of this location. Once the scene is set, inquire about what ${playerName} wishes to do next. Limit your response to a paragraph or so.`,
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
    console.error(
      "Error calling OpenAI API for starting the adventure:",
      error
    );
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

  const systemInstruction = `You are the guiding voice for the player as they navigate a mysterious location represented by a JSON object. Process their actions, consult the current state of the dungeon and any notes for bot guidance, then modify the dungeon state to reflect the consequences of those actions. When responding, ensure your reply is STRICTLY in a JSON format that looks like this - {response: '', dungeon: {}}, where 'response' contains your narration detailing the results of the player's choices, and 'dungeon' provides the updated state of the location. Any changes made should be logically consistent and in line with the details provided in the dungeon JSON.`;

  const payload = {
    model: "gpt-3.5-turbo-16k-0613",
    messages: [
      {
        role: "system",
        content: systemInstruction,
      },
      {
        role: "user",
        content: `Player's action: "${playerResponse}". Current state of the dungeon: ${JSON.stringify(
          currentDungeonState
        )}. Analyze the player's action and modify the dungeon's JSON state accordingly. For instance, if the player enters a new room, update 'player_history_with_room' to show that they had been there, and how they interacted with it. Your response should STRICTLY be in the JSON format like - {response: '', dungeon: {}}, and ensure there's no extraneous characters outside this structure. Always conclude your 'response' with a narrative hook, such as an atmospheric detail or by gently directing the player's attention to potential paths or actions. FOLLOW THE JSON FORMAT!`,
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
    console.error("Error calling OpenAI API for player response:", error);
    throw error;
  }

  const res = response.data.choices[0]?.message?.content;
  console.log("Received content:", JSON.stringify(res));

  try {
    const cleanedContent = res.replace(/\\"/g, '"');
    const parsedContent = JSON.parse(cleanedContent);
    if (parsedContent && parsedContent.dungeon && parsedContent.response) {
      sessionDungeons[sessionId] = parsedContent.dungeon;
      console.log("Updated dungeon:", JSON.stringify(parsedContent.dungeon));
      return {
        response: parsedContent.response,
        sessionId,
        updatedDungeonState: parsedContent.dungeon,
      };
    } else {
      console.error("Parsed content does not match expected structure.");
      throw new Error("Parsed content does not match expected structure.");
    }
  } catch (error) {
    console.error("Error parsing content:", error);
    throw error;
  }

  return {
    response: narrativeResponse,
    sessionId,
    updatedDungeonState: updatedDungeon,
  };
}

module.exports = {
  constructDungeon,
  startTheAdventure,
  getDungeonBySessionId,
  processPlayerResponse,
};
