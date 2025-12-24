const axios = require("axios");

const BASE_URL =
  (process.env.MSG91_WHATSAPP_BASE_URL ||
    "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message").replace(
    /\/+$/,
    ""
  );
const AUTH_KEY = process.env.MSG91_WHATSAPP_AUTH_KEY || process.env.MSG91_AUTH_KEY;
const TEMPLATE_NAMESPACE = process.env.MSG91_WHATSAPP_TEMPLATE_NAMESPACE;
const TEMPLATE_NAME = process.env.MSG91_WHATSAPP_TEMPLATE_NAME;
const TEMPLATE_LANGUAGE = process.env.MSG91_WHATSAPP_TEMPLATE_LANGUAGE || "en";
const INTEGRATED_NUMBER = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER;
const CAMPAIGN_NAME =
  process.env.MSG91_WHATSAPP_CAMPAIGN || "matrixtrack_attendance";
const REQUEST_TIMEOUT = Number(process.env.MSG91_WHATSAPP_TIMEOUT_MS || 12000);
const MAX_BODY_LENGTH = Number(
  process.env.MSG91_WHATSAPP_MAX_BODY_LENGTH || 1900
);

const ensureConfig = () => {
  const missing = [];
  if (!AUTH_KEY) missing.push("MSG91_AUTH_KEY");
  if (!INTEGRATED_NUMBER) missing.push("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  if (!TEMPLATE_NAMESPACE) missing.push("MSG91_WHATSAPP_TEMPLATE_NAMESPACE");
  if (!TEMPLATE_NAME) missing.push("MSG91_WHATSAPP_TEMPLATE_NAME");

  if (missing.length) {
    const error = new Error(
      `Missing MSG91 configuration: ${missing.join(", ")}`
    );
    error.statusCode = 500;
    throw error;
  }
};

const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return "";
  const digits = String(phoneNumber).replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
};

const buildTemplatePayload = ({ phoneNumber, parameters, meta = {} }) => ({
  integrated_number: INTEGRATED_NUMBER,
  campaign: CAMPAIGN_NAME,
  content_type: "template",
  payload: {
    to: [{ phone: phoneNumber, type: "whatsapp" }],
    type: "template",
    template: {
      namespace: TEMPLATE_NAMESPACE,
      name: TEMPLATE_NAME,
      language: {
        policy: "deterministic",
        code: TEMPLATE_LANGUAGE,
      },
      components: [
        {
          type: "body",
          parameters: parameters.map((text) => ({
            type: "text",
            text,
          })),
        },
      ],
    },
  },
  meta,
});

const parseProviderResponse = (data = {}, httpStatus = 200) => {
  const providerStatus =
    data?.data?.status ||
    data?.type ||
    (httpStatus >= 200 && httpStatus < 300 ? "queued" : "error");

  const messageId =
    data?.data?.messageId || data?.data?.id || data?.messageId || "";

  return {
    success: !["error", "failed"].includes(String(providerStatus).toLowerCase()),
    status: providerStatus,
    message:
      data?.message ||
      data?.data?.message ||
      "Request accepted by MSG91. Waiting for delivery.",
    messageId,
    providerResponse: data,
  };
};

const sendWhatsAppReport = async ({
  phoneNumber,
  reportText,
  cityName,
  date,
  zoneName,
}) => {
  ensureConfig();

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) {
    const error = new Error(
      "A valid phone number is required to send WhatsApp reports."
    );
    error.statusCode = 400;
    throw error;
  }

  const safeReport = (reportText || "").trim();
  if (!safeReport) {
    const error = new Error("Report text is required.");
    error.statusCode = 400;
    throw error;
  }

  const trimmedReport = MAX_BODY_LENGTH
    ? safeReport.slice(0, MAX_BODY_LENGTH)
    : safeReport;

  // Template placeholders: city, date, zone, full report text
  const bodyParameters = [
    cityName || "N/A",
    date || "",
    zoneName || "All Zones",
    trimmedReport,
  ];

  const payload = buildTemplatePayload({
    phoneNumber: normalizedPhone,
    parameters: bodyParameters,
    meta: {
      city: cityName,
      date,
      zone: zoneName,
    },
  });

  const url = `${BASE_URL}/`;

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        authkey: AUTH_KEY,
      },
      timeout: REQUEST_TIMEOUT,
    });

    return {
      ...parseProviderResponse(response.data, response.status),
      phoneNumber: normalizedPhone,
    };
  } catch (error) {
    const provider = error.response?.data;
    const err = new Error(
      provider?.message ||
        provider?.error ||
        error.message ||
        "Unable to send WhatsApp report via MSG91."
    );
    err.statusCode = error.response?.status || 502;
    err.providerStatus = provider?.type || provider?.status;
    err.provider = provider;
    throw err;
  }
};

module.exports = {
  sendWhatsAppReport,
  normalizePhoneNumber,
};
