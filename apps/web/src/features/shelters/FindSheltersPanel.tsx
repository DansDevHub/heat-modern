// apps/web/src/features/shelters/FindSheltersPanel.tsx

import { useState, useRef, useEffect } from "react";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";

interface FindSheltersPanelProps {
  view: any;
  isVisible?: boolean;
}

type Suggestion = { text: string; magicKey?: string; isCollection?: boolean };

interface Shelter {
  shelter_na: string;
  address: string;
  status: string;
  capacity: number;
  occupancy: number;
  pet_friend: string;
  spns_frien?: string; // Special needs friendly field (if available)
  DISTANCE_MILES?: number;
  _geometry?: {
    x: number;
    y: number;
    spatialReference?: { wkid: number };
  };
}

interface ShelterSearchResult {
  success: boolean;
  shelters: Shelter[];
  geocodedLocation?: {
    address: string;
    geometry: {
      x: number;
      y: number;
      spatialReference?: { wkid: number };
    };
  };
  error?: string;
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

// Hillsborough County brand colors
const brandBlue = "#054173";
const brandOrange = "#FF6F5B";

export default function FindSheltersPanel({ view, isVisible = true }: FindSheltersPanelProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ShelterSearchResult | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState("");

  // Filter states
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPetFriendly, setFilterPetFriendly] = useState(false);
  const [filterSpecialNeeds, setFilterSpecialNeeds] = useState(false);
  const [filterNearest, setFilterNearest] = useState(true); // Default to nearest

  // Directions state
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);

  // Clean up graphics layer on unmount or when panel is hidden
  useEffect(() => {
    if (!isVisible) {
      clearAll();
    }
    return () => {
      if (graphicsLayerRef.current && view?.map) {
        view.map.remove(graphicsLayerRef.current);
        graphicsLayerRef.current = null;
      }
    };
  }, [isVisible, view]);

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
      const resp = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(trimmed)}`, { signal: ac.signal });
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

  function pickSuggestion(s: Suggestion) {
    setQuery(s.text);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  async function searchShelters() {
    const address = query.trim();
    if (!address) return;

    setLoading(true);
    setResults(null);
    setRouteInfo(null);
    setSelectedShelter(null);
    clearGraphics();

    try {
      // Build filter where clause
      const filters: string[] = [];
      if (filterOpen) filters.push("status = 'Open'");
      if (filterPetFriendly) filters.push("pet_friend = 'Yes'");
      if (filterSpecialNeeds) filters.push("spns_frien = 'Yes'");

      const response = await fetch("/api/shelters/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          filters,
          nearest: filterNearest,
          maxResults: filterNearest ? 5 : 50 // Show more results if not filtering by nearest
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setResults({
          success: false,
          shelters: [],
          error: data.error || "Search failed"
        });
        return;
      }

      setResults(data);
      setGeocodedAddress(data.geocodedLocation?.address || address);

      // Visualize results on map
      if (data.success && data.shelters?.length > 0) {
        visualizeResults(data.shelters, data.geocodedLocation);
      }
    } catch (err) {
      setResults({
        success: false,
        shelters: [],
        error: err instanceof Error ? err.message : "Request failed"
      });
    } finally {
      setLoading(false);
    }
  }

  function visualizeResults(shelters: Shelter[], geocodedLocation?: ShelterSearchResult["geocodedLocation"]) {
    if (!view) return;

    // Create graphics layer if needed
    if (!graphicsLayerRef.current) {
      const graphicsLayer = new GraphicsLayer({
        title: "Shelter Search Results"
      });
      view.map.add(graphicsLayer);
      graphicsLayerRef.current = graphicsLayer;
    }

    // Add origin marker (user's searched location)
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
          title: "Your Location",
          content: `<b>Address:</b> ${geocodedLocation.address}`
        }
      });
      graphicsLayerRef.current?.add(originGraphic);
    }

    // Add shelter markers
    shelters.forEach((shelter, index) => {
      if (!shelter._geometry) return;

      const graphic = new Graphic({
        geometry: {
          type: "point",
          x: shelter._geometry.x,
          y: shelter._geometry.y,
          spatialReference: shelter._geometry.spatialReference || { wkid: 102100 }
        } as __esri.Point,
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          color: shelter.status === "Open" ? [40, 167, 69, 0.9] : [255, 111, 91, 0.9], // Green if open, orange if closed
          size: 14,
          outline: {
            color: [255, 255, 255],
            width: 2
          }
        }),
        attributes: shelter,
        popupTemplate: {
          title: shelter.shelter_na,
          content: `
            <b>Address:</b> ${shelter.address}<br/>
            <b>Status:</b> ${shelter.status}<br/>
            <b>Available Spaces:</b> ${shelter.capacity - shelter.occupancy}<br/>
            <b>Pet Friendly:</b> ${shelter.pet_friend}<br/>
            ${shelter.DISTANCE_MILES ? `<b>Distance:</b> ${shelter.DISTANCE_MILES.toFixed(2)} miles` : ""}
          `
        }
      });
      graphicsLayerRef.current?.add(graphic);
    });

    // Zoom to show all graphics
    if (graphicsLayerRef.current && graphicsLayerRef.current.graphics.length > 0) {
      view.goTo(graphicsLayerRef.current.graphics.toArray(), {
        padding: { top: 50, bottom: 50, left: 50, right: 550 }
      }).catch((err: any) => {
        if (err.name !== "AbortError") {
          console.warn("Error zooming to results:", err);
        }
      });
    }
  }

  async function getDirections(shelter: Shelter) {
    if (!shelter._geometry || !geocodedAddress) return;

    setDirectionsLoading(true);
    setSelectedShelter(shelter);
    setRouteInfo(null);

    // Clear previous route graphics
    if (graphicsLayerRef.current) {
      const routeGraphics = graphicsLayerRef.current.graphics.filter(
        (g: Graphic) => g.attributes?._isRoute
      );
      routeGraphics.forEach((g: Graphic) => graphicsLayerRef.current?.remove(g));
    }

    try {
      const response = await fetch("/api/ai/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originAddress: geocodedAddress,
          destinationName: `${shelter.shelter_na} - ${shelter.address}`,
          destinationCoords: { x: shelter._geometry.x, y: shelter._geometry.y }
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error("Failed to get directions:", data.error);
        return;
      }

      setRouteInfo(data.route);

      // Add route line to map
      if (data.route?.geometry?.paths && graphicsLayerRef.current) {
        const routeGraphic = new Graphic({
          geometry: {
            type: "polyline",
            paths: data.route.geometry.paths,
            spatialReference: data.route.geometry.spatialReference || { wkid: 102100 }
          } as __esri.Polyline,
          symbol: new SimpleLineSymbol({
            color: [5, 65, 115, 0.8],
            width: 4,
            style: "solid"
          }),
          attributes: { _isRoute: true }
        });
        graphicsLayerRef.current.add(routeGraphic);

        // Zoom to show route
        view.goTo(graphicsLayerRef.current.graphics.toArray(), {
          padding: { top: 50, bottom: 50, left: 50, right: 550 }
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Error getting directions:", err);
    } finally {
      setDirectionsLoading(false);
    }
  }

  function clearGraphics() {
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.removeAll();
    }
  }

  function clearAll() {
    setQuery("");
    setResults(null);
    setRouteInfo(null);
    setSelectedShelter(null);
    setGeocodedAddress("");
    setSuggestions([]);
    setShowSuggestions(false);
    clearGraphics();
  }

  const canSearch = query.trim().length > 0;

  return (
    <div style={{ padding: 12, color: "#000", height: "100%", display: "flex", flexDirection: "column" }}>
      <h2 style={{ margin: "8px 0 12px 0", color: "#000" }}>Find Shelters</h2>

      {/* Address Search */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
          Enter your address to find nearby shelters:
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search by address..."
              style={{ width: "100%", padding: 10, fontSize: 14, border: "1px solid #ddd", borderRadius: 4 }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (showSuggestions && suggestions.length > 0) {
                    pickSuggestion(suggestions[0]);
                  } else {
                    searchShelters();
                  }
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
                  marginTop: 4
                }}
              >
                {isSuggesting && (
                  <div style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>Searching...</div>
                )}
                {suggestions.map((s) => (
                  <button
                    key={`${s.magicKey ?? ""}:${s.text}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer"
                    }}
                  >
                    {s.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Options */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 13, color: "#666" }}>
          Filter Options:
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {/* Open Filter */}
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: filterOpen ? "none" : "1px solid #ddd",
              background: filterOpen ? brandBlue : "white",
              color: filterOpen ? "white" : "#333",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: filterOpen ? 600 : 400,
              transition: "all 0.2s ease"
            }}
          >
            Open
          </button>

          {/* Pet Friendly Filter */}
          <button
            onClick={() => setFilterPetFriendly(!filterPetFriendly)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: filterPetFriendly ? "none" : "1px solid #ddd",
              background: filterPetFriendly ? brandBlue : "white",
              color: filterPetFriendly ? "white" : "#333",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: filterPetFriendly ? 600 : 400,
              transition: "all 0.2s ease"
            }}
          >
            Pet Friendly
          </button>

          {/* Special Needs Filter */}
          <button
            onClick={() => setFilterSpecialNeeds(!filterSpecialNeeds)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: filterSpecialNeeds ? "none" : "1px solid #ddd",
              background: filterSpecialNeeds ? brandBlue : "white",
              color: filterSpecialNeeds ? "white" : "#333",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: filterSpecialNeeds ? 600 : 400,
              transition: "all 0.2s ease"
            }}
          >
            Special Needs
          </button>

          {/* Nearest Filter */}
          <button
            onClick={() => setFilterNearest(!filterNearest)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: filterNearest ? "none" : "1px solid #ddd",
              background: filterNearest ? brandOrange : "white",
              color: filterNearest ? "white" : "#333",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: filterNearest ? 600 : 400,
              transition: "all 0.2s ease"
            }}
          >
            Nearest
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
          {filterNearest
            ? "Results will be sorted by distance from your address"
            : "Showing all matching shelters"}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={searchShelters}
          disabled={!canSearch || loading}
          style={{
            flex: 2,
            padding: "12px 16px",
            background: brandBlue,
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: !canSearch || loading ? "not-allowed" : "pointer",
            opacity: !canSearch || loading ? 0.6 : 1,
            fontWeight: 600,
            fontSize: 14
          }}
        >
          {loading ? "Searching..." : "Find Shelters"}
        </button>
        <button
          onClick={clearAll}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: brandOrange,
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            fontSize: 14
          }}
        >
          Clear
        </button>
      </div>

      {/* Loading */}
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
            Searching for shelters...
          </div>
        </div>
      )}

      {/* Error */}
      {results && !results.success && (
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
          <div style={{ color: "#721c24", marginTop: 4 }}>{results.error}</div>
        </div>
      )}

      {/* Results */}
      {results && results.success && (
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
            <div style={{ fontWeight: 600, color: "#155724" }}>
              Found {results.shelters.length} shelter{results.shelters.length !== 1 ? "s" : ""}
              {geocodedAddress && ` near ${geocodedAddress}`}
            </div>
            <div style={{ fontSize: 12, color: "#155724", marginTop: 4 }}>
              Click on a shelter name to get directions.
            </div>
          </div>

          {/* Shelter List */}
          {results.shelters.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {results.shelters.map((shelter, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    background: selectedShelter?.shelter_na === shelter.shelter_na ? "#e3f2fd" : (idx % 2 === 0 ? "white" : "#fafafa"),
                    borderBottom: "1px solid #eee",
                    borderRadius: 4,
                    marginBottom: 4
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <button
                        onClick={() => getDirections(shelter)}
                        disabled={directionsLoading}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: brandBlue,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "underline",
                          textAlign: "left"
                        }}
                      >
                        {shelter.shelter_na}
                      </button>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                        {shelter.address}
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontSize: 11,
                            background: shelter.status === "Open" ? "#28a745" : "#dc3545",
                            color: "white"
                          }}
                        >
                          {shelter.status}
                        </span>
                        {shelter.pet_friend === "Yes" && (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 10,
                              fontSize: 11,
                              background: "#17a2b8",
                              color: "white"
                            }}
                          >
                            Pet Friendly
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "#666" }}>
                          {shelter.capacity - shelter.occupancy} spaces available
                        </span>
                      </div>
                    </div>
                    {shelter.DISTANCE_MILES !== undefined && (
                      <div style={{ textAlign: "right", minWidth: 80 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: brandBlue }}>
                          {shelter.DISTANCE_MILES.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 10, color: "#888" }}>miles</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Directions Panel */}
          {routeInfo && selectedShelter && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  padding: 12,
                  background: "#e8f4fd",
                  border: "1px solid #bee5eb",
                  borderRadius: 4,
                  marginBottom: 8
                }}
              >
                <div style={{ fontWeight: 600, color: brandBlue, marginBottom: 4 }}>
                  Directions to {selectedShelter.shelter_na}
                </div>
                <div style={{ fontSize: 13, color: "#333" }}>
                  {routeInfo.totalDistance.toFixed(1)} miles &bull; ~{Math.round(routeInfo.totalTime)} minutes
                </div>
              </div>

              {routeInfo.directions?.length > 0 && (
                <div
                  style={{
                    maxHeight: 200,
                    overflow: "auto",
                    border: "1px solid #e0e0e0",
                    borderRadius: 4,
                    background: "#fafafa"
                  }}
                >
                  {routeInfo.directions.map((dir, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 12px",
                        borderBottom: idx < routeInfo.directions.length - 1 ? "1px solid #eee" : "none",
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
              )}
            </div>
          )}

          {/* No results */}
          {results.shelters.length === 0 && (
            <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
              No shelters found matching your criteria.
              <br />
              Try adjusting your filters.
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!loading && !results && (
        <div style={{ padding: 20, textAlign: "center", color: "#666", fontSize: 13 }}>
          Enter your address above to find nearby hurricane shelters.
          <br />
          <br />
          Use the filter options to narrow down results by shelter type.
        </div>
      )}
    </div>
  );
}
