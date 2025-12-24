const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const {
  sendWhatsAppReport,
  normalizePhoneNumber,
} = require("../utils/msg91WhatsApp");

const router = express.Router();

router.use(authenticateUser);

router.post("/report", async (req, res) => {
  const { phoneNumber, reportText, cityName, date, zoneName } = req.body || {};

  if (!phoneNumber || !String(phoneNumber).trim()) {
    return res.status(400).json({ error: "phoneNumber is required." });
  }

  if (!reportText || !String(reportText).trim()) {
    return res.status(400).json({ error: "reportText is required." });
  }

  try {
    const result = await sendWhatsAppReport({
      phoneNumber,
      reportText,
      cityName,
      date,
      zoneName,
    });

    res.json({
      success: result.success,
      status: result.status,
      messageId: result.messageId,
      providerMessage: result.message,
      providerResponse: result.providerResponse,
      phoneNumber: normalizePhoneNumber(phoneNumber),
    });
  } catch (error) {
    console.error("MSG91 WhatsApp send error:", error.provider || error);

    res.status(error.statusCode || 500).json({
      error: error.message || "Unable to send WhatsApp report.",
      providerStatus: error.providerStatus,
      providerResponse: error.provider,
    });
  }
});

module.exports = router;
