// apps/web/src/features/addData/AddDataPanel.tsx

import { useState, useRef, useCallback } from "react";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import KMLLayer from "@arcgis/core/layers/KMLLayer";
import WMSLayer from "@arcgis/core/layers/WMSLayer";
import WMTSLayer from "@arcgis/core/layers/WMTSLayer";
import WFSLayer from "@arcgis/core/layers/WFSLayer";
import CSVLayer from "@arcgis/core/layers/CSVLayer";
import Layer from "@arcgis/core/layers/Layer";
import Portal from "@arcgis/core/portal/Portal";
import PortalItem from "@arcgis/core/portal/PortalItem";
import PortalQueryParams from "@arcgis/core/portal/PortalQueryParams";
import Graphic from "@arcgis/core/Graphic";
import { Point, Polyline, Polygon } from "@arcgis/core/geometry";

interface AddDataPanelProps {
  view: any;
  onClose: () => void;
}

type TabType = "search" | "url" | "file";

// Hillsborough County brand colors
const brandBlue = "#054173";
const brandOrange = "#FF6F5B";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  thumbnailUrl: string;
  type: string;
  owner: string;
}

export default function AddDataPanel({ view, onClose }: AddDataPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("url");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // URL tab state
  const [layerUrl, setLayerUrl] = useState("");
  const [layerType, setLayerType] = useState("auto");

  // File tab state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState("arcgis");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // ============== URL Tab Functions ==============
  const addLayerFromUrl = async () => {
    if (!layerUrl.trim()) {
      setError("Please enter a URL");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      let layer: __esri.Layer;

      if (layerType === "auto") {
        // Auto-detect layer type
        layer = await Layer.fromArcGISServerURL({ url: layerUrl });
      } else {
        // Create specific layer type
        switch (layerType) {
          case "feature":
            layer = new FeatureLayer({ url: layerUrl });
            break;
          case "wms":
            layer = new WMSLayer({ url: layerUrl });
            break;
          case "wmts":
            layer = new WMTSLayer({ url: layerUrl });
            break;
          case "wfs":
            layer = new WFSLayer({ url: layerUrl });
            break;
          case "kml":
            layer = new KMLLayer({ url: layerUrl });
            break;
          case "geojson":
            layer = new GeoJSONLayer({ url: layerUrl });
            break;
          case "csv":
            layer = new CSVLayer({ url: layerUrl });
            break;
          default:
            layer = await Layer.fromArcGISServerURL({ url: layerUrl });
        }
      }

      view.map.add(layer);
      setSuccess(`Layer added successfully`);
      setLayerUrl("");
    } catch (err: any) {
      console.error("Error adding layer:", err);
      setError(err.message || "Failed to add layer. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ============== File Tab Functions ==============
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const processFiles = async (files: File[]) => {
    clearMessages();
    setLoading(true);

    try {
      for (const file of files) {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith(".geojson") || fileName.endsWith(".json")) {
          await addGeoJSONFile(file);
        } else if (fileName.endsWith(".kml") || fileName.endsWith(".kmz")) {
          await addKMLFile(file);
        } else if (fileName.endsWith(".csv")) {
          await addCSVFile(file);
        } else if (fileName.endsWith(".gpx")) {
          await addGPXFile(file);
        } else if (fileName.endsWith(".zip")) {
          // Likely a shapefile
          await addShapefileZip(file);
        } else {
          throw new Error(`Unsupported file type: ${fileName}`);
        }
      }
      setSuccess(`${files.length} file(s) added successfully`);
    } catch (err: any) {
      console.error("Error processing file:", err);
      setError(err.message || "Failed to process file");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const addGeoJSONFile = async (file: File) => {
    const text = await file.text();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const layer = new GeoJSONLayer({
      url,
      title: file.name.replace(/\.(geojson|json)$/i, "")
    });

    view.map.add(layer);
    await layer.when();

    if (layer.fullExtent) {
      view.goTo(layer.fullExtent.expand(1.2));
    }
  };

  const addKMLFile = async (file: File) => {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const url = URL.createObjectURL(blob);

    const layer = new KMLLayer({
      url,
      title: file.name.replace(/\.(kml|kmz)$/i, "")
    });

    view.map.add(layer);
    await layer.when();

    if (layer.fullExtent) {
      view.goTo(layer.fullExtent.expand(1.2));
    }
  };

  const addCSVFile = async (file: File) => {
    const text = await file.text();
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const layer = new CSVLayer({
      url,
      title: file.name.replace(/\.csv$/i, "")
    });

    view.map.add(layer);
    await layer.when();

    if (layer.fullExtent) {
      view.goTo(layer.fullExtent.expand(1.2));
    }
  };

  const addGPXFile = async (file: File) => {
    const text = await file.text();
    const parser = new DOMParser();
    const gpx = parser.parseFromString(text, "text/xml");

    const graphics: Graphic[] = [];

    // Parse waypoints
    const waypoints = gpx.querySelectorAll("wpt");
    waypoints.forEach((wpt) => {
      const lat = parseFloat(wpt.getAttribute("lat") || "0");
      const lon = parseFloat(wpt.getAttribute("lon") || "0");
      const name = wpt.querySelector("name")?.textContent || "Waypoint";

      graphics.push(new Graphic({
        geometry: new Point({ latitude: lat, longitude: lon }),
        attributes: { name },
        symbol: {
          type: "simple-marker",
          color: brandOrange,
          size: 8,
          outline: { color: "white", width: 1 }
        } as any,
        popupTemplate: {
          title: "{name}"
        }
      }));
    });

    // Parse tracks
    const tracks = gpx.querySelectorAll("trk");
    tracks.forEach((trk) => {
      const name = trk.querySelector("name")?.textContent || "Track";
      const segments = trk.querySelectorAll("trkseg");

      segments.forEach((seg) => {
        const points = seg.querySelectorAll("trkpt");
        const paths: number[][] = [];

        points.forEach((pt) => {
          const lat = parseFloat(pt.getAttribute("lat") || "0");
          const lon = parseFloat(pt.getAttribute("lon") || "0");
          paths.push([lon, lat]);
        });

        if (paths.length > 1) {
          graphics.push(new Graphic({
            geometry: new Polyline({ paths: [paths] }),
            attributes: { name },
            symbol: {
              type: "simple-line",
              color: brandBlue,
              width: 3
            } as any,
            popupTemplate: {
              title: "{name}"
            }
          }));
        }
      });
    });

    if (graphics.length > 0) {
      const { default: GraphicsLayer } = await import("@arcgis/core/layers/GraphicsLayer");
      const layer = new GraphicsLayer({
        title: file.name.replace(/\.gpx$/i, ""),
        graphics
      });

      view.map.add(layer);
      view.goTo(graphics);
    }
  };

  const addShapefileZip = async (file: File) => {
    // For shapefiles, we need to use the portal's analyze and generate services
    // This requires authentication, so we'll provide a helpful error message
    setError(
      "Shapefile upload requires ArcGIS Online authentication. " +
      "Please use GeoJSON, KML, CSV, or GPX formats, or add your shapefile " +
      "as a hosted feature service via ArcGIS Online and use the URL option."
    );
  };

  // ============== Search Tab Functions ==============
  const searchPortal = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search term");
      return;
    }

    clearMessages();
    setLoading(true);
    setHasSearched(true);

    try {
      const portal = new Portal({
        url: "https://www.arcgis.com"
      });

      await portal.load();

      const queryParams = new PortalQueryParams({
        query: `${searchQuery} type:("Feature Service" OR "Map Service" OR "Image Service" OR "Vector Tile Service" OR "Scene Service" OR "KML" OR "WMS" OR "WMTS" OR "WFS" OR "GeoJSON")`,
        num: 20,
        sortField: "num-views",
        sortOrder: "desc"
      });

      // Adjust query based on search source
      if (searchSource === "livingatlas") {
        queryParams.query = `${searchQuery} type:("Feature Service" OR "Map Service" OR "Image Service" OR "Vector Tile Service") group:47dd57c9a59d458c86d3d6b978560571`;
      }

      const result = await portal.queryItems(queryParams);

      const results: SearchResult[] = result.results.map((item: PortalItem) => ({
        id: item.id,
        title: item.title,
        snippet: item.snippet || "No description available",
        thumbnailUrl: item.thumbnailUrl || "",
        type: item.type,
        owner: item.owner
      }));

      setSearchResults(results);

      if (results.length === 0) {
        setError("No results found. Try different search terms.");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const addSearchResult = async (result: SearchResult) => {
    clearMessages();
    setLoading(true);

    try {
      const portalItem = new PortalItem({
        id: result.id
      });

      const layer = await Layer.fromPortalItem({ portalItem });
      layer.title = result.title;

      view.map.add(layer);
      setSuccess(`"${result.title}" added to map`);
    } catch (err: any) {
      console.error("Error adding layer:", err);
      setError(err.message || "Failed to add layer");
    } finally {
      setLoading(false);
    }
  };

  // ============== Render Functions ==============
  const renderTabs = () => (
    <div style={{ display: "flex", borderBottom: `2px solid ${brandBlue}`, marginBottom: 16 }}>
      {[
        { id: "url" as TabType, label: "URL" },
        { id: "file" as TabType, label: "File" },
        { id: "search" as TabType, label: "Search" }
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => { setActiveTab(tab.id); clearMessages(); }}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: "none",
            background: activeTab === tab.id ? brandBlue : "transparent",
            color: activeTab === tab.id ? "white" : brandBlue,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderUrlTab = () => (
    <div>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        Add a layer from a web service URL. Supported: ArcGIS Server services, WMS, WMTS, WFS, KML, GeoJSON, CSV.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
          Layer Type
        </label>
        <select
          value={layerType}
          onChange={(e) => setLayerType(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 14
          }}
        >
          <option value="auto">Auto-detect</option>
          <option value="feature">ArcGIS Feature Service</option>
          <option value="wms">WMS (OGC)</option>
          <option value="wmts">WMTS (OGC)</option>
          <option value="wfs">WFS (OGC)</option>
          <option value="kml">KML</option>
          <option value="geojson">GeoJSON</option>
          <option value="csv">CSV</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
          URL
        </label>
        <input
          type="text"
          value={layerUrl}
          onChange={(e) => setLayerUrl(e.target.value)}
          placeholder="https://services.arcgis.com/.../FeatureServer/0"
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 14,
            boxSizing: "border-box"
          }}
          onKeyDown={(e) => e.key === "Enter" && addLayerFromUrl()}
        />
      </div>

      <button
        onClick={addLayerFromUrl}
        disabled={loading || !layerUrl.trim()}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: brandBlue,
          color: "white",
          border: "none",
          borderRadius: 4,
          fontWeight: 600,
          cursor: loading || !layerUrl.trim() ? "not-allowed" : "pointer",
          opacity: loading || !layerUrl.trim() ? 0.6 : 1
        }}
      >
        {loading ? "Adding..." : "Add Layer"}
      </button>
    </div>
  );

  const renderFileTab = () => (
    <div>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        Upload local files. Supported: GeoJSON, KML, KMZ, CSV, GPX.
      </p>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? brandOrange : "#ccc"}`,
          borderRadius: 8,
          padding: 32,
          textAlign: "center",
          cursor: "pointer",
          background: isDragging ? "rgba(255, 111, 91, 0.1)" : "#fafafa",
          transition: "all 0.2s"
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>
          {isDragging ? "+" : ""}
        </div>
        <p style={{ margin: 0, fontWeight: 600, color: brandBlue }}>
          {isDragging ? "Drop files here" : "Drag & drop files here"}
        </p>
        <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#666" }}>
          or click to browse
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept=".geojson,.json,.kml,.kmz,.csv,.gpx,.zip"
        multiple
        style={{ display: "none" }}
      />

      <p style={{ fontSize: 11, color: "#999", marginTop: 12, textAlign: "center" }}>
        Supported: GeoJSON, KML, KMZ, CSV, GPX
      </p>
    </div>
  );

  const renderSearchTab = () => (
    <div>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        Search for public layers from ArcGIS Online or the Living Atlas.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
          Search In
        </label>
        <select
          value={searchSource}
          onChange={(e) => setSearchSource(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 14
          }}
        >
          <option value="arcgis">ArcGIS Online</option>
          <option value="livingatlas">Living Atlas</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for layers..."
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 14
          }}
          onKeyDown={(e) => e.key === "Enter" && searchPortal()}
        />
        <button
          onClick={searchPortal}
          disabled={loading || !searchQuery.trim()}
          style={{
            padding: "8px 16px",
            background: brandBlue,
            color: "white",
            border: "none",
            borderRadius: 4,
            fontWeight: 600,
            cursor: loading || !searchQuery.trim() ? "not-allowed" : "pointer",
            opacity: loading || !searchQuery.trim() ? 0.6 : 1
          }}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {/* Search Results */}
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {searchResults.map((result) => (
          <div
            key={result.id}
            style={{
              display: "flex",
              gap: 12,
              padding: 12,
              borderBottom: "1px solid #eee",
              alignItems: "flex-start"
            }}
          >
            {result.thumbnailUrl && (
              <img
                src={result.thumbnailUrl}
                alt=""
                style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                {result.title}
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                {result.type} by {result.owner}
              </div>
              <div style={{ fontSize: 11, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {result.snippet}
              </div>
            </div>
            <button
              onClick={() => addSearchResult(result)}
              disabled={loading}
              style={{
                padding: "4px 10px",
                background: brandOrange,
                color: "white",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap"
              }}
            >
              Add
            </button>
          </div>
        ))}

        {hasSearched && searchResults.length === 0 && !loading && !error && (
          <p style={{ textAlign: "center", color: "#666", padding: 20 }}>
            No results found
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      padding: 16,
      color: "#000",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box"
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16
      }}>
        <h2 style={{ margin: 0, color: brandBlue, fontSize: 18 }}>Add Data</h2>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            color: "#666",
            padding: 4
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          padding: 10,
          background: "#fee",
          border: "1px solid #fcc",
          borderRadius: 4,
          marginBottom: 12,
          fontSize: 13,
          color: "#c00"
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: 10,
          background: "#efe",
          border: "1px solid #cfc",
          borderRadius: 4,
          marginBottom: 12,
          fontSize: 13,
          color: "#060"
        }}>
          {success}
        </div>
      )}

      {/* Tabs */}
      {renderTabs()}

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "url" && renderUrlTab()}
        {activeTab === "file" && renderFileTab()}
        {activeTab === "search" && renderSearchTab()}
      </div>

      {/* Footer note */}
      <p style={{
        fontSize: 11,
        color: "#999",
        textAlign: "center",
        marginTop: 16,
        marginBottom: 0
      }}>
        Added data is temporary and will not be saved.
      </p>
    </div>
  );
}
