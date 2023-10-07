var express = require("express");
var router = express.Router();
const openaiService = require("../services/openai");

/* GET DM status */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Here and ready to run a game." });
});

/* POST to Initiate a Game */
router.post("/game", async (req, res) => {
  const playerNumber = req.params.numberOfPlayers;
  const playerLevel = req.params.playerLevel;
  const [dungeon, sessionId] = await openaiService.constructDungeon(
    playerNumber,
    playerLevel
  );
  const result = await openaiService.startTheAdventure(
    dungeon,
    sessionId,
    playerNumber,
    playerLevel
  );
  res.json(result);
});

/* POST to Process Player's Action */
router.post('/chat', async (req, res) => {
    const sessionId = req.body.sessionId;
    const playerResponse = req.body.playerResponse;
  
    if (!sessionId || !playerResponse) {
      return res.status(400).json({
        error: "Please provide both sessionId and playerResponse in the request body."
      });
    }
  
    try {
      const result = await openaiService.processPlayerResponse(playerResponse, sessionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Error processing player's action."
      });
    }
  });

module.exports = router;
