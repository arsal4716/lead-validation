const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5008;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("uploads"));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".csv", ".xlsx", ".xls"];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const TRUSTEDFORM_CREDENTIALS = {
  username: "fsinta@hlgsolutions.net",
  password: "Tar@gLkA6R2Uzux16",
};

const extractCertId = (url) => {
  if (!url) return null;
  const match = url.match(/trustedform\.com\/([^/?]+)/);
  return match ? match[1].replace(".html", "") : url;
};

const validateTrustedFormToken = async (certInput) => {
  try {
    const certId = extractCertId(certInput);
    console.log(" Validating TrustedForm cert ID:", certId);

    const url = `https://cert.trustedform.com/${certId}/validate`;
    console.log("Request URL:", url);

    const response = await axios.get(url, {
      auth: {
        username: TRUSTEDFORM_CREDENTIALS.username,
        password: TRUSTEDFORM_CREDENTIALS.password,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("TrustedForm Response:", response.data);

    return {
      valid: response.data.outcome === "success",
      outcome: response.data.outcome,
      reason: response.data.reason,
      message:
        response.data.outcome === "success"
          ? "Valid certificate"
          : response.data.reason,
    };
  } catch (error) {
    console.error("TrustedForm validation error:", error.message);

    if (error.response) {
      console.error("Response Status:", error.response.status);
      console.error("Response Data:", error.response.data);
    }

    if (error.response?.status === 401) {
      return {
        valid: false,
        message: "Authentication failed - check credentials",
      };
    } else if (error.response?.status === 404) {
      return { valid: false, message: "Certificate not found" };
    }

    return {
      valid: false,
      message:
        error.response?.data?.message ||
        "Error validating TrustedForm certificate",
    };
  }
};

const validateJornayaToken = async (
  tokenId,
  lac = "675C7AD0-766C-086F-2192-FC4BF16CACF6"
) => {
  try {
    const response = await axios.get(
      `https://api.leadid.com/Authenticate?lac=${lac}&id=${tokenId}`,
      { headers: { Accept: "application/json" } }
    );

    let data =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    if (data.authenticate) {
      const authentic = Number(data.authenticate.authentic);
      return {
        valid: authentic === 1,
        token: data.authenticate.token,
        transid: data.transid,
        message: authentic === 1 ? "Valid token" : "Invalid token",
      };
    }

    return { valid: false, message: "Invalid response format from Jornaya" };
  } catch (error) {
    console.error("Jornaya validation error:", error.message);
    return {
      valid: false,
      message:
        error.response?.data?.message || "Error validating Jornaya token",
    };
  }
};

// Process CSV file
const processCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};

// Process Excel file
const processExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};
app.post("/api/validate-tokens", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!req.body.serviceType) {
      return res.status(400).json({ error: "Service type is required" });
    }

    const serviceType = req.body.serviceType;
    let tokens = [];

    const fileExt = path.extname(req.file.originalname).toLowerCase();

    if (fileExt === ".csv") {
      tokens = await processCSV(req.file.path);
    } else if (fileExt === ".xlsx" || fileExt === ".xls") {
      tokens = await processExcel(req.file.path);
    } else {
      return res.status(400).json({ error: "Unsupported file format" });
    }

    if (!tokens.length) {
      return res.status(400).json({ error: "No tokens found in file" });
    }
    let tokenColumn;

    if (serviceType === "jornaya") {
      tokenColumn = Object.keys(tokens[0]).find((key) =>
        ["token", "leadid_token", "leadid", "leadidtoken"].includes(
          key.toLowerCase().trim()
        )
      );
    } else if (serviceType === "trustedform") {
      tokenColumn = Object.keys(tokens[0]).find((key) =>
        ["certificate", "trustedform", "cert_url", "certid"].includes(
          key.toLowerCase().trim()
        )
      );
    }

    // Handle missing token column
    if (!tokenColumn) {
      return res.status(400).json({
        error: `No valid ${
          serviceType === "jornaya"
            ? "LeadID / token"
            : "TrustedForm certificate"
        } column found in file`,
      });
    }

    const validationResults = [];

    for (const [index, row] of tokens.entries()) {
      const tokenId = row[tokenColumn];

      if (!tokenId) {
        validationResults.push({
          ...row,
          validationStatus: "Missing Token ID",
          isValid: false,
          validationMessage: "Token ID is empty",
        });
        continue;
      }

      try {
        let validationResult;

        if (serviceType === "jornaya") {
          validationResult = await validateJornayaToken(tokenId);
        } else if (serviceType === "trustedform") {
          validationResult = await validateTrustedFormToken(tokenId);
        }

        validationResults.push({
          ...row,
          validationStatus: validationResult.valid ? "Valid" : "Invalid",
          isValid: validationResult.valid,
          validationMessage: validationResult.message,
          serviceType: serviceType,
          validatedAt: new Date().toISOString(),
        });
      } catch (error) {
        validationResults.push({
          ...row,
          validationStatus: "Error",
          isValid: false,
          validationMessage: `Validation error: ${error.message}`,
          serviceType: serviceType,
          validatedAt: new Date().toISOString(),
        });
      }

      // Add delay to avoid rate limiting
      if (index < tokens.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      results: validationResults,
      total: validationResults.length,
      valid: validationResults.filter((r) => r.isValid).length,
      invalid: validationResults.filter((r) => !r.isValid).length,
    });
  } catch (error) {
    console.error("Validation error:", error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Download results endpoint
app.post("/api/download-results", express.json(), (req, res) => {
  try {
    const { results, format = "csv" } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: "No results data provided" });
    }

    let fileName = `validation-results-${Date.now()}`;
    let fileContent;

    if (format === "csv") {
      fileName += ".csv";
      const headers = Object.keys(results[0]).join(",");
      const rows = results.map((row) =>
        Object.values(row)
          .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
          .join(",")
      );
      fileContent = [headers, ...rows].join("\n");

      res.setHeader("Content-Type", "text/csv");
    } else if (format === "excel") {
      fileName += ".xlsx";
      const worksheet = XLSX.utils.json_to_sheet(results);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Validation Results");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      fileContent = buffer;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    }

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(fileContent);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Error generating download file" });
  }
});
app.use(express.static(path.join(__dirname, "frontend/build")));
app.get(/^\/(?!api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/build", "index.html"));
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
