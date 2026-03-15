// apps/web/src/features/aiQuery/AiQueryPanel.tsx

import { useState, useRef, useEffect } from "react";
import { API_BASE } from "../../utils/apiBase";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import { jsPDF } from "jspdf";

interface AiQueryPanelProps {
  view: any;
}

interface RouteInfo {
  totalDistance: number;
  totalTime: number;
  directions: Array<{
    text: string;
    length: number;
    time: number;
  }>;
  geometry: {
    paths: number[][][];
    spatialReference: { wkid: number };
  };
}

interface QueryResult {
  success: boolean;
  question: string;
  plan: {
    description: string;
    steps: Array<{
      stepNumber: number;
      action: string;
      layerKey: string;
      description: string;
    }>;
  };
  results: Array<Record<string, any>>;
  summary: string;
  error?: string;
  suggestion?: string;
  geocodedLocation?: {
    address: string;
    geometry: {
      x: number;
      y: number;
      spatialReference?: { wkid: number };
    };
  };
  route?: RouteInfo;
}

interface AvailableLayer {
  key: string;
  title: string;
  description: string;
}

const EXAMPLE_QUESTIONS = [
  "What evacuation zone is 601 E Kennedy Blvd in?",
  "Find the nearest open shelter to 123 Main St Tampa",
  "Show me all open shelters",
  "What evacuation zone is my address in?"
];

// Map database field names to user-friendly display names
const FRIENDLY_HEADERS: Record<string, string> = {
  shelter_na: "Shelter Name",
  address: "Address",
  status: "Status",
  capacity: "Capacity",
  occupancy: "Occupancy",
  pet_friend: "Pets Allowed?",
  DISTANCE_MILES: "Distance (mi)",
  ZONE: "Zone",
  NAME: "Name",
  ADDRESS: "Address"
};

function getFriendlyHeader(key: string): string {
  return FRIENDLY_HEADERS[key] || key;
}

export default function AiQueryPanel({ view }: AiQueryPanelProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");
  const [availableLayers, setAvailableLayers] = useState<AvailableLayer[]>([]);
  const [showLayers, setShowLayers] = useState(false);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);

  // Directions dialog state
  const [showDirectionsDialog, setShowDirectionsDialog] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState<Record<string, any> | null>(null);
  const [startingAddress, setStartingAddress] = useState("");
  const [directionsLoading, setDirectionsLoading] = useState(false);

  // Address prompt dialog state (for "my address" type questions)
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [userAddress, setUserAddress] = useState("");

  // Track last searched address for follow-up shelter queries
  const [lastSearchedAddress, setLastSearchedAddress] = useState("");

  // Check Ollama health on mount
  useEffect(() => {
    checkOllamaHealth();
    fetchAvailableLayers();
  }, []);

  // Clean up graphics layer on unmount
  useEffect(() => {
    return () => {
      if (graphicsLayerRef.current && view?.map) {
        view.map.remove(graphicsLayerRef.current);
        graphicsLayerRef.current = null;
      }
    };
  }, [view]);

  const checkOllamaHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai/health`);
      const data = await response.json();
      setOllamaStatus(data.ok ? "online" : "offline");
    } catch {
      setOllamaStatus("offline");
    }
  };

  const fetchAvailableLayers = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai/layers`);
      const data = await response.json();
      setAvailableLayers(data.layers || []);
    } catch (err) {
      console.error("Failed to fetch layers:", err);
    }
  };

  // Check if question contains phrases that need user's address
  const needsUserAddress = (q: string): boolean => {
    const patterns = [
      /\bmy\s+address\b/i,
      /\bmy\s+location\b/i,
      /\bmy\s+home\b/i,
      /\bmy\s+house\b/i,
      /\bwhere\s+i\s+live\b/i,
      /\bwhere\s+i\s+am\b/i,
      /\bam\s+i\s+in\b/i,
      /\bdo\s+i\s+need\s+to\s+evacuate\b/i
    ];
    return patterns.some(p => p.test(q));
  };

  // Replace "my address" type phrases with actual address
  const replaceAddressPlaceholder = (q: string, address: string): string => {
    return q
      .replace(/\bmy\s+address\b/gi, address)
      .replace(/\bmy\s+location\b/gi, address)
      .replace(/\bmy\s+home\b/gi, address)
      .replace(/\bmy\s+house\b/gi, address)
      .replace(/\bwhere\s+i\s+live\b/gi, address)
      .replace(/\bwhere\s+i\s+am\b/gi, address);
  };

  const submitQuery = async (overrideQuestion?: string | React.MouseEvent) => {
    // Handle case where called as onClick handler (receives event instead of string)
    const queryText = typeof overrideQuestion === 'string'
      ? overrideQuestion
      : question.trim();
    if (!queryText || loading) return;

    // Check if we need to prompt for address
    // Only prompt when called from button click (MouseEvent) or no argument - not when called with explicit string override
    if (typeof overrideQuestion !== 'string' && needsUserAddress(queryText)) {
      setPendingQuestion(queryText);
      setUserAddress("");
      setShowAddressPrompt(true);
      return;
    }

    setLoading(true);
    setResult(null);
    clearGraphics();

    try {
      const response = await fetch(`${API_BASE}/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText })
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          question,
          plan: { description: "", steps: [] },
          results: [],
          summary: "",
          error: data.error || "Query failed",
          suggestion: data.suggestion
        });
        return;
      }

      setResult(data);

      // Visualize results on map if we have geometry
      if (data.success && data.results?.length > 0) {
        visualizeResults(data.results, data.geocodedLocation, data.route);
      }
    } catch (err) {
      setResult({
        success: false,
        question,
        plan: { description: "", steps: [] },
        results: [],
        summary: "",
        error: err instanceof Error ? err.message : "Request failed"
      });
    } finally {
      setLoading(false);
    }
  };

  const visualizeResults = (
    results: Array<Record<string, any>>,
    geocodedLocation?: QueryResult["geocodedLocation"],
    route?: RouteInfo
  ) => {
    if (!view) return;

    // Create graphics layer if needed
    if (!graphicsLayerRef.current) {
      const graphicsLayer = new GraphicsLayer({
        title: "AI Query Results"
      });
      view.map.add(graphicsLayer);
      graphicsLayerRef.current = graphicsLayer;
    }

    // Add route polyline first (so it renders below markers)
    if (route?.geometry?.paths) {
      const routeGraphic = new Graphic({
        geometry: {
          type: "polyline",
          paths: route.geometry.paths,
          spatialReference: route.geometry.spatialReference || { wkid: 102100 }
        } as __esri.Polyline,
        symbol: new SimpleLineSymbol({
          color: [5, 65, 115, 0.8], // Brand blue
          width: 4,
          style: "solid"
        }),
        attributes: {
          _isRoute: true,
          totalDistance: route.totalDistance,
          totalTime: route.totalTime
        },
        popupTemplate: {
          title: "Driving Route",
          content: `<b>Distance:</b> ${route.totalDistance.toFixed(2)} miles<br/><b>Time:</b> ${Math.round(route.totalTime)} minutes`
        }
      });
      graphicsLayerRef.current?.add(routeGraphic);
    }

    // Add geocoded location marker (origin point) with distinct blue style
    if (geocodedLocation?.geometry) {
      const originGraphic = new Graphic({
        geometry: {
          type: "point",
          x: geocodedLocation.geometry.x,
          y: geocodedLocation.geometry.y,
          spatialReference: geocodedLocation.geometry.spatialReference || { wkid: 102100 }
        } as __esri.Point,
        symbol: new SimpleMarkerSymbol({
          style: "diamond",
          color: [5, 65, 115, 0.9], // Brand blue
          size: 16,
          outline: {
            color: [255, 255, 255],
            width: 2
          }
        }),
        attributes: { ADDRESS: geocodedLocation.address, _isOrigin: true },
        popupTemplate: {
          title: "Search Location",
          content: `<b>Address:</b> ${geocodedLocation.address}`
        }
      });
      graphicsLayerRef.current?.add(originGraphic);
    }

    // Add result graphics - check for geometry in various patterns
    results.forEach((item) => {
      // Check for geometry in _geometry (from executor) or other common patterns
      const geometry = item._geometry || item.geometry || item.SHAPE;

      if (!geometry) return;

      // Point geometry (x, y coordinates)
      if (geometry.x !== undefined && geometry.y !== undefined) {
        const graphic = new Graphic({
          geometry: {
            type: "point",
            x: geometry.x,
            y: geometry.y,
            spatialReference: geometry.spatialReference || { wkid: 102100 }
          } as __esri.Point,
          symbol: new SimpleMarkerSymbol({
            color: [255, 111, 91, 0.9], // Brand orange
            size: 14,
            outline: {
              color: [255, 255, 255],
              width: 2
            }
          }),
          attributes: item,
          popupTemplate: {
            title: item.NAME || item.ADDRESS || "Result",
            content: Object.entries(item)
              .filter(([k]) => !k.startsWith("_") && !["SHAPE", "geometry"].includes(k))
              .slice(0, 6)
              .map(([k, v]) => `<b>${k}:</b> ${v}`)
              .join("<br/>")
          }
        });
        graphicsLayerRef.current?.add(graphic);
      }
      // Polygon geometry (rings)
      else if (geometry.rings) {
        const graphic = new Graphic({
          geometry: {
            type: "polygon",
            rings: geometry.rings,
            spatialReference: geometry.spatialReference || { wkid: 102100 }
          } as __esri.Polygon,
          symbol: new SimpleFillSymbol({
            color: [255, 111, 91, 0.3],
            outline: {
              color: [255, 111, 91, 1],
              width: 2
            }
          }),
          attributes: item,
          popupTemplate: {
            title: item.NAME || item.ADDRESS || "Result",
            content: Object.entries(item)
              .filter(([k]) => !k.startsWith("_") && !["SHAPE", "geometry", "rings"].includes(k))
              .slice(0, 6)
              .map(([k, v]) => `<b>${k}:</b> ${v}`)
              .join("<br/>")
          }
        });
        graphicsLayerRef.current?.add(graphic);
      }
      // Polyline geometry (paths)
      else if (geometry.paths) {
        const graphic = new Graphic({
          geometry: {
            type: "polyline",
            paths: geometry.paths,
            spatialReference: geometry.spatialReference || { wkid: 102100 }
          } as __esri.Polyline,
          symbol: {
            type: "simple-line",
            color: [255, 111, 91, 1],
            width: 3
          } as any,
          attributes: item
        });
        graphicsLayerRef.current?.add(graphic);
      }
    });

    // Zoom to show all graphics (origin + results)
    if (graphicsLayerRef.current && graphicsLayerRef.current.graphics.length > 0) {
      view.goTo(graphicsLayerRef.current.graphics.toArray(), {
        padding: { top: 50, bottom: 50, left: 450, right: 400 }
      }).catch((err: any) => {
        if (err.name !== "AbortError") {
          console.warn("Error zooming to results:", err);
        }
      });
    }
  };

  const clearGraphics = () => {
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.removeAll();
    }
  };

  const clearAll = () => {
    setQuestion("");
    setResult(null);
    clearGraphics();
    setShowDirectionsDialog(false);
    setSelectedShelter(null);
    setStartingAddress("");
    setShowAddressPrompt(false);
    setPendingQuestion("");
    setUserAddress("");
    setLastSearchedAddress("");
  };

  const handleShelterClick = (shelter: Record<string, any>) => {
    setSelectedShelter(shelter);
    setStartingAddress("");
    setShowDirectionsDialog(true);
  };

  const getDirections = async () => {
    if (!startingAddress.trim() || !selectedShelter) return;

    setDirectionsLoading(true);
    setShowDirectionsDialog(false);

    const shelterName = selectedShelter.shelter_na || selectedShelter.NAME || "the shelter";
    const shelterAddress = selectedShelter.address || selectedShelter.ADDRESS || "";
    const directionsQuery = `Directions from ${startingAddress} to ${shelterName}`;

    setQuestion(directionsQuery);

    try {
      // Get shelter coordinates from geometry
      const shelterGeom = selectedShelter._geometry;
      if (!shelterGeom || shelterGeom.x === undefined || shelterGeom.y === undefined) {
        throw new Error("Shelter location not available");
      }

      // Call dedicated directions endpoint with coordinates
      const response = await fetch(`${API_BASE}/ai/directions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originAddress: startingAddress,
          destinationName: `${shelterName} - ${shelterAddress}`,
          destinationCoords: { x: shelterGeom.x, y: shelterGeom.y }
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setResult({
          success: false,
          question: directionsQuery,
          plan: { description: "", steps: [] },
          results: [],
          summary: "",
          error: data.error || "Failed to get directions"
        });
        return;
      }

      // Build result in the expected format
      const routeResult: QueryResult = {
        success: true,
        question: directionsQuery,
        plan: {
          description: `Get directions to ${shelterName}`,
          steps: [{ stepNumber: 1, action: "route", layerKey: "", description: "Calculate route" }]
        },
        results: [{
          ORIGIN: data.origin.address,
          DESTINATION: data.destination.name,
          DISTANCE_MILES: data.route.totalDistance.toFixed(2),
          TIME_MINUTES: Math.round(data.route.totalTime)
        }],
        summary: `Directions to ${shelterName}: ${data.route.totalDistance.toFixed(1)} miles, approximately ${Math.round(data.route.totalTime)} minutes.`,
        geocodedLocation: {
          address: data.origin.address,
          geometry: data.origin.geometry
        },
        route: data.route
      };

      setResult(routeResult);

      // Visualize route on map
      visualizeResults(routeResult.results, routeResult.geocodedLocation, routeResult.route);
    } catch (err) {
      setResult({
        success: false,
        question: directionsQuery,
        plan: { description: "", steps: [] },
        results: [],
        summary: "",
        error: err instanceof Error ? err.message : "Failed to get directions"
      });
    } finally {
      setDirectionsLoading(false);
      setSelectedShelter(null);
      setStartingAddress("");
    }
  };

  const submitWithAddress = () => {
    if (!userAddress.trim() || !pendingQuestion) return;

    // Save the address for potential follow-up shelter queries
    setLastSearchedAddress(userAddress.trim());

    // Replace placeholder with actual address
    const updatedQuestion = replaceAddressPlaceholder(pendingQuestion, userAddress.trim());
    setQuestion(updatedQuestion);
    setShowAddressPrompt(false);
    setPendingQuestion("");
    setUserAddress("");

    // Submit the updated question
    submitQuery(updatedQuestion);
  };

  // Check if the summary is asking about finding shelters (after evacuation zone query)
  const showShelterPrompt = result?.success &&
    result.summary?.toLowerCase().includes("would you like me to find the nearest shelter");

  // Check if we just showed a shelter result and should offer more options
  const hasShelterResults = result?.success &&
    result.results?.some(r => r.shelter_na !== undefined) &&
    !result.summary?.toLowerCase().includes("would you like me to find the nearest shelter");

  // Get the address to use for shelter queries - prefer lastSearchedAddress, fallback to geocoded location
  const addressForShelterQuery = lastSearchedAddress || result?.geocodedLocation?.address || "";

  // Find the nearest shelter (any status)
  const findNearestShelter = async () => {
    if (!addressForShelterQuery || loading) return;

    const shelterQuestion = `Find the nearest shelter to ${addressForShelterQuery}`;
    setQuestion(shelterQuestion);
    // Keep the address for follow-up queries
    submitQuery(shelterQuestion);
  };

  // Find nearest open shelter
  const findNearestOpenShelter = async () => {
    if (!addressForShelterQuery || loading) return;

    const shelterQuestion = `Find the nearest open shelter to ${addressForShelterQuery}`;
    setQuestion(shelterQuestion);
    submitQuery(shelterQuestion);
  };

  // Find nearest pet-friendly shelter
  const findNearestPetFriendlyShelter = async () => {
    if (!addressForShelterQuery || loading) return;

    const shelterQuestion = `Find the nearest pet-friendly shelter to ${addressForShelterQuery}`;
    setQuestion(shelterQuestion);
    submitQuery(shelterQuestion);
  };

  // Render summary with clickable shelter names
  const renderSummaryWithLinks = (summary: string) => {
    if (!result?.results || result.results.length === 0) {
      return summary;
    }

    // Get shelter names from results
    const shelterNames = result.results
      .filter(r => r.shelter_na)
      .map(r => r.shelter_na as string);

    if (shelterNames.length === 0) {
      return summary;
    }

    // Split summary by shelter names and create clickable elements
    const parts: (string | JSX.Element)[] = [];
    let remainingText = summary;
    let keyIndex = 0;

    for (const shelterName of shelterNames) {
      const shelter = result.results.find(r => r.shelter_na === shelterName);
      if (!shelter) continue;

      const index = remainingText.indexOf(shelterName);
      if (index === -1) continue;

      // Add text before the shelter name
      if (index > 0) {
        parts.push(remainingText.substring(0, index));
      }

      // Add clickable shelter name
      parts.push(
        <button
          key={`shelter-${keyIndex++}`}
          onClick={() => handleShelterClick(shelter)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: brandBlue,
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "inherit",
            fontFamily: "inherit",
            fontWeight: 600
          }}
          title="Click for directions"
        >
          {shelterName}
        </button>
      );

      remainingText = remainingText.substring(index + shelterName.length);
    }

    // Add any remaining text
    if (remainingText) {
      parts.push(remainingText);
    }

    return parts.length > 0 ? parts : summary;
  };

  const exportToPDF = () => {
    if (!result?.results?.length) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Hillsborough County brand colors
    const deepSeaBlue: [number, number, number] = [5, 65, 115];
    const skyOrange: [number, number, number] = [255, 111, 91];

    // Header
    doc.setFillColor(...deepSeaBlue);
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("AI Query Results", margin, 15);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const questionLines = doc.splitTextToSize(`Q: ${result.question}`, pageWidth - 2 * margin);
    doc.text(questionLines.slice(0, 2), margin, 24);

    doc.text(`Results: ${result.results.length}`, margin, 36);
    doc.text(new Date().toLocaleDateString(), pageWidth - margin - 30, 36);

    let yPosition = 50;

    // Summary
    if (result.summary) {
      doc.setTextColor(...deepSeaBlue);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Summary", margin, yPosition);
      yPosition += 6;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const summaryLines = doc.splitTextToSize(result.summary, pageWidth - 2 * margin);
      doc.text(summaryLines, margin, yPosition);
      yPosition += summaryLines.length * 5 + 8;
    }

    // Results table header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, "F");
    doc.setFillColor(...skyOrange);
    doc.rect(margin, yPosition, 3, 8, "F");

    // Get column headers from first result
    const columns = Object.keys(result.results[0] || {}).slice(0, 4);
    const colWidth = (pageWidth - 2 * margin) / columns.length;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...deepSeaBlue);
    columns.forEach((col, idx) => {
      doc.text(col.substring(0, 15), margin + 5 + idx * colWidth, yPosition + 5);
    });

    yPosition += 12;

    // Results rows
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    result.results.forEach((row, rowIdx) => {
      if (yPosition > pageHeight - 25) {
        doc.addPage();
        yPosition = 20;
      }

      if (rowIdx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 6, "F");
      }

      columns.forEach((col, idx) => {
        const value = String(row[col] ?? "").substring(0, 20);
        doc.text(value, margin + 5 + idx * colWidth, yPosition);
      });

      yPosition += 6;
    });

    // Footer
    const footerY = pageHeight - 10;
    doc.setFontSize(8);
    doc.setTextColor(...deepSeaBlue);
    doc.setFont("helvetica", "bold");
    doc.text("Hillsborough County", margin, footerY);
    doc.setTextColor(...skyOrange);
    doc.text("Florida", margin + 38, footerY);

    doc.save(`AI_Query_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // Hillsborough County brand colors
  const brandBlue = "#054173";
  const brandOrange = "#FF6F5B";

  return (
    <div style={{ padding: 12, color: "#000", height: "100%", display: "flex", flexDirection: "column" }}>
      <h2 style={{ margin: "8px 0 12px 0", color: "#000", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>AI Query</span>
        <span
          style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 10,
            background: ollamaStatus === "online" ? "#28a745" : ollamaStatus === "offline" ? brandOrange : brandBlue,
            color: "white"
          }}
        >
          {ollamaStatus === "checking" ? "..." : ollamaStatus}
        </span>
      </h2>

      {ollamaStatus === "offline" && (
        <div
          style={{
            padding: 12,
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 13
          }}
        >
          <strong>Ollama is not running.</strong>
          <br />
          Please start Ollama to use AI queries.
          <button
            onClick={checkOllamaHealth}
            style={{
              marginTop: 8,
              padding: "4px 12px",
              background: brandBlue,
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 13, marginBottom: 8, color: "#666" }}>
          Ask questions about geographic data in natural language.
        </p>

        {/* Question Input */}
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., Which schools are within 500 feet of a water treatment plant?"
          disabled={loading || ollamaStatus === "offline"}
          style={{
            width: "100%",
            minHeight: 80,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 4,
            fontSize: 14,
            resize: "vertical",
            fontFamily: "inherit",
            opacity: loading || ollamaStatus === "offline" ? 0.6 : 1
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitQuery();
            }
          }}
        />

        {/* Example Questions */}
        <div style={{ marginTop: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Try an example:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {EXAMPLE_QUESTIONS.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => setQuestion(ex)}
                disabled={loading}
                style={{
                  padding: "4px 8px",
                  background: "#f0f0f0",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  fontSize: 11,
                  cursor: loading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%"
                }}
                title={ex}
              >
                {ex.length > 35 ? ex.substring(0, 35) + "..." : ex}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={submitQuery}
            disabled={loading || !question.trim() || ollamaStatus === "offline"}
            style={{
              flex: 2,
              padding: "10px 16px",
              background: brandBlue,
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading || !question.trim() || ollamaStatus === "offline" ? "not-allowed" : "pointer",
              opacity: loading || !question.trim() || ollamaStatus === "offline" ? 0.6 : 1,
              fontWeight: 600
            }}
          >
            {loading ? "Analyzing..." : "Ask Question"}
          </button>
          <button
            onClick={clearAll}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: brandOrange,
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1
            }}
          >
            Clear
          </button>
        </div>

        {/* Show Available Layers Toggle */}
        <button
          onClick={() => setShowLayers(!showLayers)}
          style={{
            width: "100%",
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid #ddd",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            color: "#666",
            textAlign: "left"
          }}
        >
          {showLayers ? "Hide" : "Show"} Available Layers ({availableLayers.length})
        </button>

        {showLayers && (
          <div
            style={{
              marginTop: 8,
              maxHeight: 150,
              overflow: "auto",
              border: "1px solid #eee",
              borderRadius: 4,
              padding: 8,
              fontSize: 11
            }}
          >
            {availableLayers.map((layer) => (
              <div key={layer.key} style={{ marginBottom: 4 }}>
                <strong>{layer.title}</strong>
                <span style={{ color: "#888", marginLeft: 4 }}>({layer.key})</span>
                <div style={{ color: "#666", fontSize: 10 }}>{layer.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div style={{ padding: "16px 0", textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              width: 24,
              height: 24,
              border: "3px solid #f0f0f0",
              borderTopColor: brandBlue,
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
            Analyzing your question and querying data...
          </div>
        </div>
      )}

      {/* Error Display */}
      {result && !result.success && (
        <div
          style={{
            padding: 12,
            background: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: 4,
            marginBottom: 12
          }}
        >
          <strong style={{ color: "#721c24" }}>Error:</strong>
          <div style={{ color: "#721c24", marginTop: 4 }}>{result.error}</div>
          {result.suggestion && (
            <div style={{ color: "#856404", marginTop: 8, fontSize: 12 }}>
              <strong>Suggestion:</strong> {result.suggestion}
            </div>
          )}
        </div>
      )}

      {/* Results Display */}
      {result && result.success && (
        <div style={{ flex: 1, overflow: "auto" }}>
          {/* Summary */}
          <div
            style={{
              padding: 12,
              background: "#d4edda",
              border: "1px solid #c3e6cb",
              borderRadius: 4,
              marginBottom: 12
            }}
          >
            <div style={{ fontWeight: 600, color: "#155724", marginBottom: 4 }}>Summary</div>
            <div style={{ color: "#155724", whiteSpace: "pre-line" }}>
              {/* Remove the shelter prompt from the displayed summary - we'll show buttons instead */}
              {/* Make shelter names clickable for directions */}
              {renderSummaryWithLinks(
                result.summary?.replace(/\n*Would you like me to find the nearest shelter to your location\?/i, "") || ""
              )}
            </div>

            {/* Instructional text for shelter results */}
            {hasShelterResults && (
              <div style={{
                marginTop: 8,
                fontSize: 12,
                color: "#155724",
                fontStyle: "italic",
                opacity: 0.8
              }}>
                Click on a shelter name above to get directions.
              </div>
            )}

            {/* Shelter follow-up buttons - after evacuation zone query */}
            {showShelterPrompt && addressForShelterQuery && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #c3e6cb" }}>
                <div style={{ fontSize: 13, color: "#155724", marginBottom: 8 }}>
                  Would you like me to find the nearest shelter to your location?
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={findNearestShelter}
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      background: brandBlue,
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                      fontWeight: 600,
                      fontSize: 13
                    }}
                  >
                    Yes, Find Nearest Shelter
                  </button>
                  <button
                    onClick={clearAll}
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      background: "#f0f0f0",
                      color: "#333",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      fontSize: 13
                    }}
                  >
                    Ask Something Else
                  </button>
                </div>
              </div>
            )}

            {/* More shelter options - after showing a shelter result */}
            {hasShelterResults && addressForShelterQuery && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #c3e6cb" }}>
                <div style={{ fontSize: 13, color: "#155724", marginBottom: 8 }}>
                  Find a different type of shelter:
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={findNearestOpenShelter}
                    disabled={loading}
                    style={{
                      padding: "8px 14px",
                      background: brandBlue,
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                      fontWeight: 600,
                      fontSize: 12
                    }}
                  >
                    Nearest Open Shelter
                  </button>
                  <button
                    onClick={findNearestPetFriendlyShelter}
                    disabled={loading}
                    style={{
                      padding: "8px 14px",
                      background: brandBlue,
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                      fontWeight: 600,
                      fontSize: 12
                    }}
                  >
                    Nearest Pet-Friendly Shelter
                  </button>
                  <button
                    onClick={clearAll}
                    disabled={loading}
                    style={{
                      padding: "8px 14px",
                      background: "#f0f0f0",
                      color: "#333",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      fontSize: 12
                    }}
                  >
                    Ask Something Else
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Query Plan (collapsible) */}
          {result.plan?.steps?.length > 0 && (
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#666" }}>
                Query Plan ({result.plan.steps.length} steps)
              </summary>
              <div style={{ marginTop: 8, paddingLeft: 12, fontSize: 12 }}>
                {result.plan.steps.map((step) => (
                  <div key={step.stepNumber} style={{ marginBottom: 6 }}>
                    <span style={{ color: brandOrange, fontWeight: 600 }}>Step {step.stepNumber}:</span>{" "}
                    <span style={{ color: "#666" }}>[{step.action}]</span> {step.description}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Driving Directions (if route available) */}
          {result.route && result.route.directions?.length > 0 && (
            <details style={{ marginBottom: 12 }} open>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: brandBlue }}>
                Driving Directions ({result.route.totalDistance.toFixed(2)} mi, ~{Math.round(result.route.totalTime)} min)
              </summary>
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 200,
                  overflow: "auto",
                  border: "1px solid #e0e0e0",
                  borderRadius: 4,
                  background: "#fafafa"
                }}
              >
                {result.route.directions.map((dir, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "8px 12px",
                      borderBottom: idx < result.route!.directions.length - 1 ? "1px solid #eee" : "none",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10
                    }}
                  >
                    <span
                      style={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: brandBlue,
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#333" }}>{dir.text}</div>
                      {dir.length > 0 && (
                        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                          {dir.length.toFixed(2)} mi
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Results Count & Export */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Results: {result.results.length}</div>
            <button
              onClick={exportToPDF}
              disabled={result.results.length === 0}
              style={{
                padding: "6px 12px",
                background: brandBlue,
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: result.results.length === 0 ? "not-allowed" : "pointer",
                opacity: result.results.length === 0 ? 0.6 : 1,
                fontSize: 12
              }}
            >
              Export PDF
            </button>
          </div>

          {/* Results Table */}
          {result.results.length > 0 && (
            <div style={{ overflow: "auto", maxHeight: 300 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    {Object.keys(result.results[0])
                      .filter((k) => !["SHAPE", "geometry", "rings", "_geometry"].includes(k) && !k.startsWith("_"))
                      .slice(0, 6)
                      .map((key) => (
                        <th
                          key={key}
                          style={{
                            padding: "6px 8px",
                            textAlign: "left",
                            borderBottom: "2px solid #ddd",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {getFriendlyHeader(key)}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results.slice(0, 50).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                      {Object.entries(row)
                        .filter(([k]) => !["SHAPE", "geometry", "rings", "_geometry"].includes(k) && !k.startsWith("_"))
                        .slice(0, 6)
                        .map(([key, value]) => (
                          <td key={key} style={{ padding: "4px 8px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {/* Make shelter names clickable for directions */}
                            {key === "shelter_na" && row.address ? (
                              <button
                                onClick={() => handleShelterClick(row)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color: brandBlue,
                                  textDecoration: "underline",
                                  cursor: "pointer",
                                  fontSize: "inherit",
                                  textAlign: "left"
                                }}
                                title="Click for directions"
                              >
                                {String(value ?? "").substring(0, 50)}
                              </button>
                            ) : (
                              String(value ?? "").substring(0, 50)
                            )}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.results.length > 50 && (
                <div style={{ padding: 8, textAlign: "center", color: "#666", fontSize: 11 }}>
                  Showing 50 of {result.results.length} results
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Directions Dialog */}
      {showDirectionsDialog && selectedShelter && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setShowDirectionsDialog(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: 24,
              width: 480,
              maxWidth: "90%",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", color: brandBlue }}>
              Get Directions
            </h3>
            <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#666" }}>
              <strong>To:</strong> {selectedShelter.shelter_na || selectedShelter.NAME}
            </p>
            <p style={{ margin: "0 0 16px 0", fontSize: 12, color: "#888" }}>
              {selectedShelter.address || selectedShelter.ADDRESS}
            </p>

            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Starting Address:
            </label>
            <input
              type="text"
              value={startingAddress}
              onChange={(e) => setStartingAddress(e.target.value)}
              placeholder="Enter your starting address (e.g., 601 E Kennedy Blvd, Tampa)"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: 4,
                fontSize: 14,
                marginBottom: 16,
                boxSizing: "border-box"
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  getDirections();
                }
              }}
              autoFocus
            />

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDirectionsDialog(false)}
                style={{
                  padding: "10px 20px",
                  background: "#f0f0f0",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 14
                }}
              >
                Cancel
              </button>
              <button
                onClick={getDirections}
                disabled={!startingAddress.trim() || directionsLoading}
                style={{
                  padding: "10px 20px",
                  background: brandBlue,
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: !startingAddress.trim() || directionsLoading ? "not-allowed" : "pointer",
                  opacity: !startingAddress.trim() || directionsLoading ? 0.6 : 1,
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                {directionsLoading ? "Loading..." : "Get Directions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address Prompt Dialog (for "my address" type questions) */}
      {showAddressPrompt && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => {
            setShowAddressPrompt(false);
            setPendingQuestion("");
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: 24,
              width: 480,
              maxWidth: "90%",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", color: brandBlue }}>
              What's Your Address?
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#666" }}>
              To answer your question, we need to know your address.
            </p>

            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Your Address:
            </label>
            <input
              type="text"
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              placeholder="Enter your address (e.g., 601 E Kennedy Blvd, Tampa)"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: 4,
                fontSize: 14,
                marginBottom: 16,
                boxSizing: "border-box"
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  submitWithAddress();
                }
              }}
              autoFocus
            />

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowAddressPrompt(false);
                  setPendingQuestion("");
                }}
                style={{
                  padding: "10px 20px",
                  background: "#f0f0f0",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 14
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitWithAddress}
                disabled={!userAddress.trim()}
                style={{
                  padding: "10px 20px",
                  background: brandBlue,
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: !userAddress.trim() ? "not-allowed" : "pointer",
                  opacity: !userAddress.trim() ? 0.6 : 1,
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
