// apps/web/src/features/addressList/AddressListPanel.tsx

import { useState, useRef, useEffect } from "react";
import { API_BASE } from "../../utils/apiBase";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import { jsPDF } from "jspdf";

interface AddressListPanelProps {
  view: any;
}

interface ParcelData {
  folio: string;
  siteAddress: string;
  ownerName: string;
  mailingAddress: string;
  geometry?: any;
}

export default function AddressListPanel({ view }: AddressListPanelProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [parcels, setParcels] = useState<ParcelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<any>(null);
  const [bufferDistance, setBufferDistance] = useState<string>("");
  const [bufferUnit, setBufferUnit] = useState<"feet" | "miles">("feet");
  const graphicsLayerRef = useRef<any>(null);
  const clickHandlerRef = useRef<any>(null);

  // Clean up click handler and graphics layer when component unmounts
  useEffect(() => {
    return () => {
      if (clickHandlerRef.current) {
        clickHandlerRef.current.remove();
        clickHandlerRef.current = null;
      }
      if (graphicsLayerRef.current && view?.map) {
        view.map.remove(graphicsLayerRef.current);
        graphicsLayerRef.current = null;
      }
    };
  }, [view]);

  const selectParcel = async () => {
    if (!view) return;

    if (isSelecting) {
      // Stop selecting
      if (clickHandlerRef.current) {
        clickHandlerRef.current.remove();
        clickHandlerRef.current = null;
      }
      setIsSelecting(false);
    } else {
      // Start selecting
      setIsSelecting(true);

      // Create graphics layer for highlights if it doesn't exist
      if (!graphicsLayerRef.current) {
        const graphicsLayer = new GraphicsLayer({
          title: "Address List Selection"
        });
        view.map.add(graphicsLayer);
        graphicsLayerRef.current = graphicsLayer;
      }

      // Add click handler
      clickHandlerRef.current = view.on("click", async (event: any) => {
        event.stopPropagation();

        const response = await view.hitTest(event);
        const parcelHit = response.results.find(
          (result: any) => result.graphic?.layer?.title === "Parcels"
        );

        if (parcelHit) {
          const attributes = parcelHit.graphic.attributes;
          const geometry = parcelHit.graphic.geometry;

          // Clear previous selection
          if (graphicsLayerRef.current) {
            graphicsLayerRef.current.removeAll();
          }

          // Set selected parcel
          setSelectedParcel({ attributes, geometry });

          // Add highlight graphic
          const highlightGraphic = new Graphic({
            geometry: geometry,
            symbol: new SimpleFillSymbol({
              color: [255, 165, 0, 0.3],
              style: "solid",
              outline: {
                color: [255, 165, 0, 1],
                width: 3
              }
            })
          });

          graphicsLayerRef.current.add(highlightGraphic);

          // Stop selecting after first parcel is selected
          if (clickHandlerRef.current) {
            clickHandlerRef.current.remove();
            clickHandlerRef.current = null;
          }
          setIsSelecting(false);
        }
      });
    }
  };

  const runBuffer = async () => {
    if (!view || !selectedParcel || !bufferDistance) return;

    const distance = parseFloat(bufferDistance);
    if (isNaN(distance) || distance <= 0) {
      alert("Please enter a valid buffer distance greater than 0");
      return;
    }

    setLoading(true);
    setParcels([]);

    try {
      // Import required modules
      const { default: Polygon } = await import("@arcgis/core/geometry/Polygon");

      // Convert distance based on unit
      let distanceInFeet = distance;
      if (bufferUnit === "miles") {
        distanceInFeet = distance * 5280; // miles to feet
      }

      // Use Hillsborough County's geometry service for buffer
      const geometryServiceUrl = "https://maps.hillsboroughcounty.org/arcgis/rest/services/Utilities/Geometry/GeometryServer";

      // Get spatial reference from the selected parcel
      const wkid = selectedParcel.geometry.spatialReference?.wkid || 102100;

      console.log("Selected parcel geometry:", selectedParcel.geometry);
      console.log("Spatial reference WKID:", wkid);

      // Prepare geometry for buffer request
      const geometries = {
        geometryType: "esriGeometryPolygon",
        geometries: [{
          rings: selectedParcel.geometry.rings,
          spatialReference: { wkid }
        }]
      };

      // Call geometry service buffer endpoint
      const bufferUrl = `${geometryServiceUrl}/buffer`;
      const params = new URLSearchParams({
        f: "json",
        geometries: JSON.stringify(geometries),
        inSR: String(wkid),
        outSR: String(wkid),
        distances: String(distanceInFeet),
        unit: "9003", // 9003 = US Survey Feet (used by backend)
        unionResults: "true"
      });

      const bufferResponse = await fetch(bufferUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      const bufferResult = await bufferResponse.json();

      console.log("Buffer result:", bufferResult);

      if (bufferResult.error) {
        console.error("Buffer error:", bufferResult.error);
        throw new Error(bufferResult.error.message || "Buffer operation failed");
      }

      const bufferedGeometry = bufferResult.geometries?.[0];
      if (!bufferedGeometry?.rings) {
        console.error("No geometry in buffer result:", bufferResult);
        throw new Error("No buffer geometry returned");
      }

      console.log("Buffer geometry created successfully", bufferedGeometry);

      // Create Polygon from buffer result
      const bufferGeometry = new Polygon({
        rings: bufferedGeometry.rings,
        spatialReference: bufferedGeometry.spatialReference || selectedParcel.geometry.spatialReference
      });

      // Add buffer graphic to map
      const bufferGraphic = new Graphic({
        geometry: bufferGeometry,
        symbol: new SimpleFillSymbol({
          color: [0, 122, 194, 0.1],
          style: "solid",
          outline: {
            color: [0, 122, 194, 1],
            width: 2,
            style: "dash"
          }
        })
      });
      graphicsLayerRef.current.add(bufferGraphic);

      // Query parcels using the backend API instead of direct ArcGIS query
      // This uses the same approach as the backend buffer functionality
      console.log("Using backend API to query parcels");
      console.log("Buffer geometry spatial reference WKID:", bufferGeometry.spatialReference.wkid);
      console.log("Buffer geometry rings count:", bufferGeometry.rings.length);

      // Call the backend API endpoint to query parcels
      const queryResponse = await fetch(`${API_BASE}/overlays/query-parcels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geometry: {
            rings: bufferGeometry.rings,
            spatialReference: { wkid: bufferGeometry.spatialReference.wkid }
          }
        })
      });

      if (!queryResponse.ok) {
        const errorText = await queryResponse.text();
        console.error("Backend query failed:", errorText);
        throw new Error(`Backend query failed: ${queryResponse.status} ${errorText}`);
      }

      const queryResult = await queryResponse.json();
      console.log("Query result from backend:", queryResult);

      if (!queryResult.features || queryResult.features.length === 0) {
        console.log("No parcels found in query result");
        alert("No parcels found within the buffer area.");
        setLoading(false);
        return;
      }

      console.log(`Found ${queryResult.features.length} parcels`);

      // Map results to parcel data and add highlights
      const parcelData: ParcelData[] = queryResult.features.map((feature: any) => {
        // Add highlight for each parcel in buffer
        const parcelGraphic = new Graphic({
          geometry: feature.geometry,
          symbol: new SimpleFillSymbol({
            color: [0, 122, 194, 0.2],
            style: "solid",
            outline: {
              color: [0, 122, 194, 1],
              width: 2
            }
          })
        });
        graphicsLayerRef.current.add(parcelGraphic);

        return {
          folio: feature.attributes.FOLIO_NUMB || "N/A",
          siteAddress: feature.attributes.SITE_ADDR || "N/A",
          ownerName: feature.attributes.OWNER || "N/A",
          mailingAddress: feature.attributes.ADDR_1 || "N/A",
          geometry: feature.geometry
        };
      });

      setParcels(parcelData);

      // Zoom to buffer extent
      view.goTo(bufferGeometry.extent.expand(1.2));
    } catch (error) {
      console.error("Error creating buffer:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    // Stop selecting mode
    if (clickHandlerRef.current) {
      clickHandlerRef.current.remove();
      clickHandlerRef.current = null;
    }
    setIsSelecting(false);

    // Clear graphics
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.removeAll();
    }

    // Clear state
    setParcels([]);
    setSelectedParcel(null);
    setBufferDistance("");
  };

  const exportToPDF = () => {
    if (parcels.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Hillsborough County brand colors
    const deepSeaBlue = [5, 65, 115];
    const skyOrange = [255, 111, 91];

    // Header background
    doc.setFillColor(...deepSeaBlue);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Address List Report", margin, 15);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Parcels: ${parcels.length}`, margin, 23);
    doc.text(new Date().toLocaleDateString(), margin, 30);

    // Reset text color
    doc.setTextColor(0, 0, 0);

    let yPosition = 45;

    // Table headers
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, pageWidth - (2 * margin), 8, 'F');
    doc.setFillColor(...skyOrange);
    doc.rect(margin, yPosition, 3, 8, 'F');

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...deepSeaBlue);
    doc.text("Folio", margin + 5, yPosition + 5);
    doc.text("Site Address", margin + 40, yPosition + 5);
    doc.text("Owner Name", margin + 100, yPosition + 5);

    yPosition += 12;

    // Table rows
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    parcels.forEach((parcel, idx) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }

      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition - 3, pageWidth - (2 * margin), 6, 'F');
      }

      doc.setFont("helvetica", "normal");
      doc.text(parcel.folio, margin + 5, yPosition);
      doc.text(doc.splitTextToSize(parcel.siteAddress, 55)[0], margin + 40, yPosition);
      doc.text(doc.splitTextToSize(parcel.ownerName, 55)[0], margin + 100, yPosition);

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

    // Save PDF
    doc.save(`Address_List_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div style={{ padding: 12, color: "#000", height: "100%", display: "flex", flexDirection: "column" }}>
      <h2 style={{ margin: "8px 0 16px 0", color: "#000" }}>Create Address List</h2>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, marginBottom: 12 }}>
          Select a parcel, enter a buffer distance, and generate an address list for all parcels within the buffer.
        </p>

        {/* Step 1: Select Parcel */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>Step 1: Select Parcel</div>
          <button
            onClick={selectParcel}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: isSelecting ? "#2c3e50" : selectedParcel ? "#28a745" : "#0079c1",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              width: "100%"
            }}
          >
            {isSelecting ? "Click a Parcel on Map..." : selectedParcel ? "✓ Parcel Selected" : "Select Parcel"}
          </button>
          {selectedParcel && (
            <div style={{ fontSize: 12, marginTop: 4, color: "#666" }}>
              Selected: {selectedParcel.attributes.SITE_ADDR || selectedParcel.attributes.FOLIO_NUMB}
            </div>
          )}
        </div>

        {/* Step 2: Buffer Settings */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>Step 2: Buffer Settings</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, marginBottom: 4 }}>Buffer Distance</label>
              <input
                type="number"
                value={bufferDistance}
                onChange={(e) => setBufferDistance(e.target.value)}
                placeholder="Enter distance"
                disabled={loading || !selectedParcel}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  opacity: loading || !selectedParcel ? 0.6 : 1
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, marginBottom: 4 }}>Select Units for Buffer</label>
              <select
                value={bufferUnit}
                onChange={(e) => setBufferUnit(e.target.value as "feet" | "miles")}
                disabled={loading || !selectedParcel}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  opacity: loading || !selectedParcel ? 0.6 : 1
                }}
              >
                <option value="feet">Feet</option>
                <option value="miles">Miles</option>
              </select>
            </div>
          </div>

          <button
            onClick={runBuffer}
            disabled={loading || !selectedParcel || !bufferDistance}
            style={{
              padding: "8px 16px",
              background: "#0079c1",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading || !selectedParcel || !bufferDistance ? "not-allowed" : "pointer",
              opacity: loading || !selectedParcel || !bufferDistance ? 0.6 : 1,
              width: "100%"
            }}
          >
            {loading ? "Running Buffer..." : "Run Buffer"}
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={clearAll}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: "#c1504d",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              flex: 1
            }}
          >
            Clear All
          </button>

          <button
            onClick={exportToPDF}
            disabled={parcels.length === 0}
            style={{
              padding: "8px 16px",
              background: "#2c3e50",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: parcels.length === 0 ? "not-allowed" : "pointer",
              opacity: parcels.length === 0 ? 0.6 : 1,
              flex: 1
            }}
          >
            Export to PDF
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: "12px 0", color: "#0079c1", fontWeight: 600 }}>Analyzing buffer area...</div>}

      {parcels.length > 0 && (
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Results: {parcels.length} parcels
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ padding: "8px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Folio</th>
                <th style={{ padding: "8px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Site Address</th>
                <th style={{ padding: "8px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((parcel, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "6px 8px" }}>{parcel.folio}</td>
                  <td style={{ padding: "6px 8px" }}>{parcel.siteAddress}</td>
                  <td style={{ padding: "6px 8px" }}>{parcel.ownerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
