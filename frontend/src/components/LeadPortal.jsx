import React, { useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
const LeadPortal = () => {
  const [file, setFile] = useState(null);
  const [serviceType, setServiceType] = useState("jornaya");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("csv");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowedTypes = [".csv", ".xlsx", ".xls"];
      const fileExt = selectedFile.name
        .toLowerCase()
        .substring(selectedFile.name.lastIndexOf("."));

      if (!allowedTypes.includes(fileExt)) {
        toast.error("Please upload a CSV or Excel file");
        e.target.value = "";
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setIsLoading(true);
    setResults(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("serviceType", serviceType);

    try {
      const response = await axios.post("/api/validate-tokens", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 300000,
      });

      setResults(response.data);
      toast.success(
        `Validation completed! ${response.data.valid} valid, ${response.data.invalid} invalid out of ${response.data.total} tokens`
      );
    } catch (error) {
      console.error("Validation error:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Validation failed";
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!results) return;

    try {
      const response = await axios.post(
        "/api/download-results",
        {
          results: results.results,
          format: downloadFormat,
        },
        {
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `validation-results-${Date.now()}.${downloadFormat}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Download started!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Error downloading results");
    }
  };

  const getStatusBadge = (isValid) => {
    return isValid ? (
      <span className="badge bg-success">Valid</span>
    ) : (
      <span className="badge bg-danger">Invalid</span>
    );
  };

  return (
    <div className="App">
      <div className="container-fluid py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8">
            {/* Header */}
            <div className="text-center mb-5">
              <h1 className="display-4 fw-bold text-white mb-3">
                Token Validator
              </h1>
              <p className="lead text-white">
                Validate Jornaya (LeadID) and TrustedForm tokens in bulk
              </p>
            </div>

            <div className="card shadow-lg mb-4">
              <div className="card-header bg-primary text-white">
                <h5 className="card-title mb-0">Upload File for Validation</h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="row mb-4">
                    <div className="col-12">
                      <label className="form-label fw-semibold">
                        Select Validation Service:
                      </label>
                      <div className="d-flex gap-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="serviceType"
                            id="jornaya"
                            value="jornaya"
                            checked={serviceType === "jornaya"}
                            onChange={(e) => setServiceType(e.target.value)}
                          />
                          <label className="form-check-label" htmlFor="jornaya">
                            Jornaya (LeadID)
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="serviceType"
                            id="trustedform"
                            value="trustedform"
                            checked={serviceType === "trustedform"}
                            onChange={(e) => setServiceType(e.target.value)}
                          />
                          <label
                            className="form-check-label"
                            htmlFor="trustedform"
                          >
                            TrustedForm
                          </label>
                        </div>
                        {serviceType === "jornaya" && (
                          <p className="text-muted small mt-2">
                            For <strong>Jornaya</strong>, your sheet must
                            include a column named <code>leadid_Token</code> or{" "}
                            <code>token</code>.
                          </p>
                        )}

                        {serviceType === "trustedform" && (
                          <p className="text-muted small mt-2">
                            For <strong>TrustedForm</strong>, your sheet must
                            include a column named <code>certificate</code>.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* File Upload */}
                  <div className="row mb-4">
                    <div className="col-12">
                      <label
                        htmlFor="fileUpload"
                        className="form-label fw-semibold"
                      >
                        Upload CSV or Excel File
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        id="fileUpload"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileChange}
                        disabled={isLoading}
                      />
                      <div className="form-text">
                        File should contain a column with token/certificate IDs.
                        Supported formats: CSV, XLSX, XLS
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="row">
                    <div className="col-12">
                      <button
                        type="submit"
                        className="btn btn-primary btn-lg w-100"
                        disabled={isLoading || !file}
                      >
                        {isLoading ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            Validating Tokens...
                          </>
                        ) : (
                          "Validate Tokens"
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Results Section */}
            {results && (
              <div className="card shadow-lg">
                <div className="card-header bg-success text-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="card-title mb-0">Validation Results</h5>
                    <div className="d-flex gap-2 align-items-center">
                      <select
                        className="form-select form-select-sm"
                        value={downloadFormat}
                        onChange={(e) => setDownloadFormat(e.target.value)}
                        style={{ width: "auto" }}
                      >
                        <option value="csv">CSV</option>
                        <option value="excel">Excel</option>
                      </select>
                      <button
                        className="btn btn-light btn-sm"
                        onClick={handleDownload}
                      >
                        Download Results
                      </button>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {/* Summary */}
                  <div className="row mb-4">
                    <div className="col-md-3">
                      <div className="card text-center bg-light">
                        <div className="card-body">
                          <h3 className="text-primary">{results.total}</h3>
                          <p className="mb-0">Total Tokens</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center bg-success text-white">
                        <div className="card-body">
                          <h3>{results.valid}</h3>
                          <p className="mb-0">Valid</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center bg-danger text-white">
                        <div className="card-body">
                          <h3>{results.invalid}</h3>
                          <p className="mb-0">Invalid</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center bg-info text-white">
                        <div className="card-body">
                          <h3>
                            {Math.round((results.valid / results.total) * 100)}%
                          </h3>
                          <p className="mb-0">Success Rate</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Results Table */}
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          {Object.keys(results.results[0]).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.results.slice(0, 10).map((result, index) => (
                          <tr key={index}>
                            {Object.values(result).map((value, cellIndex) => (
                              <td key={cellIndex}>
                                {typeof value === "boolean"
                                  ? getStatusBadge(value)
                                  : String(value || "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {results.results.length > 10 && (
                      <div className="text-center text-muted mt-2">
                        Showing first 10 of {results.results.length} records.
                        Download full results for complete data.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default LeadPortal;
