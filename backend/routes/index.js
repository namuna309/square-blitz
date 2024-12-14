const express = require("express");
const router = express.Router();

// 간단한 테스트 API
router.get("/status", (req, res) => {
  res.json({ message: "API is working!" });
});

module.exports = router;
