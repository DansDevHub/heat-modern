// apps/web/src/features/results/ResultsPanel.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../utils/apiBase";
import { useResultsStore } from "./state";
import { jsPDF } from "jspdf";

type Suggestion = { text: string; magicKey?: string; isCollection?: boolean };

interface ResultsPanelProps {
  view?: any;
  isVisible?: boolean;
}

export default function ResultsPanel({ view, isVisible = true }: ResultsPanelProps) {
  const { lookup, setLastClick, runLookup, results, loading, clearResults } = useResultsStore();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    console.log("ResultsPanel: lookup changed:", lookup);
    if (!lookup) return;
    console.log("ResultsPanel: running lookup");
    runLookup(lookup);
  }, [lookup, runLookup]);

  // Clear results when the panel is hidden
  useEffect(() => {
    if (!isVisible) {
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      clearResults();
    }
  }, [isVisible, clearResults]);

  const siteInfo = results?.sections?.SiteInfo ?? [];
  const hasSiteInfo = siteInfo.length > 0;

  const rows = results?.rows ?? [];
  const hasRows = rows.length > 0;

  const hasAnything = hasSiteInfo || hasRows;

  // Get PIN and format for Property Appraiser link
  const pinRow = siteInfo.find(row => row.label === "PIN");
  const propertyAppraiserUrl = useMemo(() => {
    if (!pinRow?.value) return null;

    // PIN format: U-02-30-19-1QV-C00000-00023.0
    // URL format: 1930021QVC00000000230U
    const parts = pinRow.value.split("-");
    if (parts.length !== 7) return null;

    // Rearrange: parts[3] + parts[2] + parts[1] + parts[4] + parts[5] + parts[6](no dot) + parts[0]
    const reformatted = `${parts[3]}${parts[2]}${parts[1]}${parts[4]}${parts[5]}${parts[6].replace(".", "")}${parts[0]}`;
    return `https://gis.hcpafl.org/propertysearch/#/parcel/basic/${reformatted}`;
  }, [pinRow?.value]);

  // Get Google Street View URL using parcel geometry centroid
  const googleStreetViewUrl = useMemo(() => {
    const geometry = results?.parcel?.geometry;
    if (!geometry?.rings || geometry.rings.length === 0) return null;

    // Calculate centroid from polygon rings
    const ring = geometry.rings[0];
    let sumX = 0, sumY = 0;
    for (const point of ring) {
      sumX += point[0];
      sumY += point[1];
    }
    const centroidX = sumX / ring.length;
    const centroidY = sumY / ring.length;

    // Convert Web Mercator (102100/3857) to WGS84 (lat/lng)
    const lng = (centroidX * 180) / 20037508.34;
    const lat = (Math.atan(Math.exp((centroidY * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;

    // Google Street View URL with coordinates
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  }, [results?.parcel?.geometry]);

  // Temporary debug - check actual structure
  if (results && siteInfo.length === 0 && Object.keys(results.sections || {}).length > 0) {
    console.log("Available sections:", Object.keys(results.sections));
  }

  const canSearch = useMemo(() => query.trim().length > 0, [query]);

  async function runSuggest(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsSuggesting(true);
    try {
      const resp = await fetch(`${API_BASE}/geocode/suggest?q=${encodeURIComponent(trimmed)}`, { signal: ac.signal });
      const json = await resp.json();
      setSuggestions(json.suggestions ?? []);
      setShowSuggestions(true);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } finally {
      setIsSuggesting(false);
    }
  }

  function onQueryChange(next: string) {
    setQuery(next);

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSuggest(next), 180);
  }

  function submitRawText() {
    const text = query.trim();
    if (!text) return;

    setShowSuggestions(false);
    setSuggestions([]);

    // Composite locator accepts folios OR addresses — treat everything as locator text.
    setLastClick({ type: "locator", text });
  }

  function pickSuggestion(s: Suggestion) {
    setQuery(s.text);
    setShowSuggestions(false);
    setSuggestions([]);

    setLastClick({ type: "locator", text: s.text, magicKey: s.magicKey });
  }

  async function generatePDF() {
    if (!results || !hasSiteInfo) return;

    // Get folio number and site address from site info
    const folioRow = siteInfo.find(row => row.label === "Folio Number");
    const folio = folioRow?.value || "Unknown";
    const addressRow = siteInfo.find(row => row.label === "Site Address");
    const siteAddress = addressRow?.value || "Unknown";

    // Get current date
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const columnWidth = (pageWidth - (3 * margin)) / 2;

    // Hillsborough County brand colors
    const deepSeaBlue = [5, 65, 115]; // RGB for #054173
    const skyOrange = [255, 111, 91]; // RGB for #FF6F5B

    // Header background (Hillsborough County deep sea blue)
    doc.setFillColor(...deepSeaBlue);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Title in white
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Property Report", margin, 15);

    // Try to add logo on the right side of header (after background is drawn)
    try {
      const logoResponse = await fetch('/assets/hc-logo-horizontal-white.png');
      if (logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        const logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });

        // Add logo to right side of header (adjusted for aspect ratio)
        const logoWidth = 45;
        const logoHeight = 12;
        const logoX = pageWidth - margin - logoWidth;
        const logoY = 12;
        doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
      }
    } catch (error) {
      console.warn("Could not load logo for PDF:", error);
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(siteAddress, margin, 23);
    doc.setFontSize(9);
    doc.text(date, margin, 30);

    // Reset text color to black
    doc.setTextColor(0, 0, 0);

    let yPosition = 45;

    // Site Information Section Header (with orange accent)
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, pageWidth - (2 * margin), 8, 'F');
    // Orange accent bar on left
    doc.setFillColor(...skyOrange);
    doc.rect(margin, yPosition, 3, 8, 'F');
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...deepSeaBlue);
    doc.text("Site Information", margin + 6, yPosition + 5);
    doc.setTextColor(0, 0, 0);

    yPosition += 12;

    // Left column - All Site Info
    const leftColumnX = margin;
    let leftY = yPosition;
    doc.setFontSize(8);

    siteInfo.forEach((row, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(leftColumnX, leftY - 3, columnWidth, 6, 'F');
      }

      doc.setFont("helvetica", "bold");
      doc.text(row.label, leftColumnX + 2, leftY);

      doc.setFont("helvetica", "normal");
      const splitValue = doc.splitTextToSize(row.value, columnWidth - 50);
      doc.text(splitValue, leftColumnX + 50, leftY);

      leftY += Math.max(splitValue.length * 4, 6);
    });

    // Right column - Map screenshot
    const rightColumnX = margin + columnWidth + margin;
    let rightY = yPosition;

    // Capture map screenshot if view is available
    if (view && results?.parcel?.geometry) {
      try {
        const screenshot = await view.takeScreenshot({ format: "png" });
        if (screenshot?.dataUrl) {
          const mapHeight = 60;
          doc.addImage(screenshot.dataUrl, 'PNG', rightColumnX, rightY, columnWidth, mapHeight);
          rightY += mapHeight + 5;
        }
      } catch (error) {
        console.error("Failed to capture map screenshot:", error);
      }
    }

    // Calculate where to start Additional Information
    yPosition = Math.max(leftY, rightY) + 10;

    // Additional Information section if present
    if (hasRows) {
      // Section header (with orange accent)
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, pageWidth - (2 * margin), 8, 'F');
      // Orange accent bar on left
      doc.setFillColor(...skyOrange);
      doc.rect(margin, yPosition, 3, 8, 'F');
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...deepSeaBlue);
      doc.text("Additional Information", margin + 6, yPosition + 5);
      doc.setTextColor(0, 0, 0);

      yPosition += 12;
      doc.setFontSize(8);

      // Split rows into two columns
      const halfRows = Math.ceil(rows.length / 2);
      const leftRows = rows.slice(0, halfRows);
      const rightRows = rows.slice(halfRows);

      // Left column
      let leftRowY = yPosition;
      leftRows.forEach((row, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(leftColumnX, leftRowY - 3, columnWidth, 6, 'F');
        }

        doc.setFont("helvetica", "bold");
        doc.text(row.label, leftColumnX + 2, leftRowY);

        doc.setFont("helvetica", "normal");
        const splitValue = doc.splitTextToSize(row.value, columnWidth - 50);
        doc.text(splitValue, leftColumnX + 50, leftRowY);

        leftRowY += Math.max(splitValue.length * 4, 6);
      });

      // Right column
      let rightRowY = yPosition;
      rightRows.forEach((row, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(rightColumnX, rightRowY - 3, columnWidth, 6, 'F');
        }

        doc.setFont("helvetica", "bold");
        doc.text(row.label, rightColumnX + 2, rightRowY);

        doc.setFont("helvetica", "normal");
        const splitValue = doc.splitTextToSize(row.value, columnWidth - 50);
        doc.text(splitValue, rightColumnX + 50, rightRowY);

        rightRowY += Math.max(splitValue.length * 4, 6);
      });
    }

    // Footer with Hillsborough County branding
    const footerY = pageHeight - 10;
    doc.setFontSize(8);
    doc.setTextColor(...deepSeaBlue);
    doc.setFont("helvetica", "bold");
    doc.text("Hillsborough County", margin, footerY);
    doc.setTextColor(...skyOrange);
    doc.text("Florida", margin + 38, footerY);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin - 60, footerY);

    // Save the PDF
    doc.save(`Property_Report_${folio}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  return (
    <div style={{ padding: 12, color: "#000" }}>
      <h2 style={{ margin: "8px 0", color: "#000" }}>Your Results</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "stretch" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by address or folio…"
            style={{ width: "100%", padding: 8 }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onBlur={() => {
              // Let clicks on suggestions register before closing
              window.setTimeout(() => setShowSuggestions(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // If suggestions are open, pick the first one; otherwise submit raw text
                if (showSuggestions && suggestions.length > 0) pickSuggestion(suggestions[0]);
                else submitRawText();
              }
              if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
          />

          {showSuggestions && (suggestions.length > 0 || isSuggesting) && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 50,
                maxHeight: 280,
                overflowY: "auto",
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              {isSuggesting && (
                <div style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>Searching…</div>
              )}

              {suggestions.map((s) => (
                <button
                  key={`${s.magicKey ?? ""}:${s.text}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                  onClick={() => pickSuggestion(s)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  {s.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={submitRawText}
          style={{ padding: "8px 12px" }}
          disabled={!canSearch}
        >
          Search
        </button>
      </div>

      {/* Action Buttons - Only show when results are available */}
      {hasSiteInfo && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <button
            onClick={generatePDF}
            className="esri-widget esri-widget--button"
            style={{
              width: "100%",
              padding: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              border: "1px solid #0079c1",
              background: "#0079c1",
              color: "white",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: 500
            }}
            title="Generate Property Report PDF"
          >
            <span className="esri-icon-printer" style={{ fontSize: 16 }}></span>
            <span>Print Property Report</span>
          </button>

          {propertyAppraiserUrl && (
            <a
              href={propertyAppraiserUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="esri-widget esri-widget--button"
              style={{
                width: "100%",
                padding: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                border: "1px solid #054173",
                background: "#054173",
                color: "white",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
                boxSizing: "border-box"
              }}
              title="View on Property Appraiser website"
            >
              <span className="esri-icon-link-external" style={{ fontSize: 16 }}></span>
              <span>View on Property Appraiser</span>
            </a>
          )}

          {googleStreetViewUrl && (
            <a
              href={googleStreetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="esri-widget esri-widget--button"
              style={{
                width: "100%",
                padding: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                border: "1px solid #34a853",
                background: "#34a853",
                color: "white",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
                boxSizing: "border-box"
              }}
              title="View on Google Street View"
            >
              <span className="esri-icon-map-pin" style={{ fontSize: 16 }}></span>
              <span>Google Street View</span>
            </a>
          )}
        </div>
      )}

      {loading && <div>Loading…</div>}
      {results?.error && <div style={{ color: "crimson" }}>{results.error}</div>}

      {/* Site Info (from ResultsResponse.sections.SiteInfo) */}
      {!loading && hasSiteInfo && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Site Info</div>

          <div>
            {siteInfo.map((row, idx) => (
              <div
                key={`site-${row.label ?? idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px minmax(0, 1fr)",
                  columnGap: 12,
                  alignItems: "start",
                  padding: "6px 0",
                  borderBottom: idx < siteInfo.length - 1 ? "1px solid #eee" : "none",
                  color: "#000"
                }}
              >
                <div style={{ fontWeight: 600, color: "#000" }}>{row.label}</div>
                <div style={{ whiteSpace: "pre-line", overflowWrap: "anywhere", color: "#000" }}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other result rows (reserved for buffering/layers) */}
      {!loading && hasRows && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`row-${idx}`}>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "6px 8px",
                    fontWeight: 600,
                    width: 140,
                    verticalAlign: "top",
                    color: "#000"
                  }}
                >
                  {r.label}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "6px 8px", verticalAlign: "top", color: "#000" }}>
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !results?.error && !hasAnything && (
        <div>Click a parcel on the map, or search by address/folio.</div>
      )}
    </div>
  );
}
