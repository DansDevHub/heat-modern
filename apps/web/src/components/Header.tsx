import { useEffect, useRef, useState } from "react";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import LayerList from "@arcgis/core/widgets/LayerList";
import Legend from "@arcgis/core/widgets/Legend";
import ResultsPanel from "../features/results/ResultsPanel";
import AiQueryPanel from "../features/aiQuery/AiQueryPanel";

interface HeaderProps {
  view: any;
}

export default function Header({ view }: HeaderProps) {
  const basemapContainerRef = useRef<HTMLDivElement | null>(null);
  const layerListContainerRef = useRef<HTMLDivElement | null>(null);
  const legendContainerRef = useRef<HTMLDivElement | null>(null);
  const [showBasemap, setShowBasemap] = useState(false);
  const [showLayers, setShowLayers] = useState(false); // Default to hidden
  const [showLegend, setShowLegend] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showAiQuery, setShowAiQuery] = useState(false);

  // Position state for draggable panels - start next to results pane
  const [layerPosition, setLayerPosition] = useState({
    x: window.innerWidth - 380 - 320, // 380 = results pane, 320 = layer panel width + margin
    y: 100
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Create BasemapGallery widget when visible
  useEffect(() => {
    if (!view || !showBasemap || !basemapContainerRef.current) return;

    const basemapGallery = new BasemapGallery({
      view: view,
      container: basemapContainerRef.current
    });

    return () => {
      basemapGallery.destroy();
    };
  }, [view, showBasemap]);

  // Create LayerList widget when visible
  useEffect(() => {
    if (!view || !showLayers || !layerListContainerRef.current) return;

    const layerList = new LayerList({
      view: view,
      container: layerListContainerRef.current
    });

    return () => {
      layerList.destroy();
    };
  }, [view, showLayers]);

  // Create Legend widget when visible
  useEffect(() => {
    if (!view || !showLegend || !legendContainerRef.current) return;

    const legend = new Legend({
      view: view,
      container: legendContainerRef.current
    });

    return () => {
      legend.destroy();
    };
  }, [view, showLegend]);

  // Update map UI padding when left panels open/close
  useEffect(() => {
    if (!view) return;

    // AI Query panel is 520px wide
    const leftPadding = showAiQuery ? 535 : 15;

    view.ui.padding = {
      ...view.ui.padding,
      left: leftPadding
    };
  }, [view, showAiQuery]);

  // Drag handlers for layer list panel
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - layerPosition.x,
      y: e.clientY - layerPosition.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setLayerPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Hillsborough County brand colors
  const brandBlue = "#054173";
  const brandOrange = "#FF6F5B";

  return (
    <div
      style={{
        height: 60,
        background: brandBlue,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "relative",
        zIndex: 10
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img
          src="/assets/hc-logo-horizontal-white.png"
          alt="Hillsborough County"
          style={{ height: 40 }}
        />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
          HEAT
        </h1>
        <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
          Hurricane Evacuation Assessment Tool
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {/* Results Button */}
        <button
          onClick={() => setShowResults(!showResults)}
          className="esri-widget esri-widget--button"
          style={{
            width: 40,
            height: 40,
            background: showResults ? brandOrange : "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Results"
        >
          <span className="esri-icon-description" style={{ fontSize: 16, color: "white" }}></span>
        </button>

        {/* Legend Button */}
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="esri-widget esri-widget--button"
          style={{
            width: 40,
            height: 40,
            background: showLegend ? brandOrange : "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Legend"
        >
          <span className="esri-icon-legend" style={{ fontSize: 16, color: "white" }}></span>
        </button>

        {/* Layer List Button */}
        <button
          onClick={() => setShowLayers(!showLayers)}
          className="esri-widget esri-widget--button"
          style={{
            width: 40,
            height: 40,
            background: showLayers ? brandOrange : "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Layer List"
        >
          <span className="esri-icon-layers" style={{ fontSize: 16, color: "white" }}></span>
        </button>

        {/* Basemap Gallery Button */}
        <button
          onClick={() => setShowBasemap(!showBasemap)}
          className="esri-widget esri-widget--button"
          style={{
            width: 40,
            height: 40,
            background: showBasemap ? brandOrange : "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Basemap Gallery"
        >
          <span className="esri-icon-basemap" style={{ fontSize: 16, color: "white" }}></span>
        </button>

        {/* AI Query Button */}
        <button
          onClick={() => setShowAiQuery(!showAiQuery)}
          className="esri-widget esri-widget--button"
          style={{
            width: 40,
            height: 40,
            background: showAiQuery ? brandOrange : "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="AI Query"
        >
          <span className="esri-icon-search" style={{ fontSize: 16, color: "white" }}></span>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.3)", margin: "0 4px" }} />

        {/* Help Button */}
        <a
          href="/assets/HEAT_User_Guide.docx"
          download
          className="esri-widget esri-widget--button"
          style={{
            width: 40,
            height: 40,
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none"
          }}
          title="Download User Guide"
        >
          <span className="esri-icon-question" style={{ fontSize: 16, color: "white" }}></span>
        </a>
      </div>

      {/* Legend Panel */}
      {showLegend && (
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 160,
            background: "white",
            borderRadius: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 1000,
            padding: 12,
            minWidth: 250,
            maxHeight: 500,
            overflow: "auto"
          }}
        >
          <div ref={legendContainerRef} style={{ width: "100%" }} />
        </div>
      )}

      {/* Basemap Gallery Panel */}
      {showBasemap && (
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 100,
            background: "white",
            borderRadius: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 1000,
            padding: 12,
            minWidth: 300,
            maxHeight: 400,
            overflow: "auto"
          }}
        >
          <div ref={basemapContainerRef} style={{ width: "100%" }} />
        </div>
      )}

      {/* Layer List Panel - Draggable */}
      {showLayers && (
        <div
          style={{
            position: "fixed",
            left: layerPosition.x,
            top: layerPosition.y,
            background: "white",
            borderRadius: 4,
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
            zIndex: 1000,
            cursor: isDragging ? "grabbing" : "default",
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 120px)", // Leave space for header and margin
            width: 300
          }}
        >
          <div
            onMouseDown={handleMouseDown}
            style={{
              padding: "8px 12px",
              background: brandBlue,
              color: "white",
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              cursor: "grab",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              userSelect: "none",
              flexShrink: 0
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Layers</span>
            <button
              onClick={() => setShowLayers(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: 18,
                padding: 0,
                width: 20,
                height: 20
              }}
              title="Close"
            >
              ×
            </button>
          </div>
          <div
            ref={layerListContainerRef}
            style={{
              overflow: "auto",
              flexGrow: 1
            }}
          />
        </div>
      )}

      {/* Results Panel - Always mounted but conditionally visible */}
      <div
        style={{
          position: "fixed",
          top: 60,
          right: showResults ? 0 : -380,
          bottom: 0,
          width: 380,
          background: "white",
          boxShadow: "-2px 0 8px rgba(0,0,0,0.2)",
          zIndex: 1000,
          overflow: "auto",
          transition: "right 0.3s ease-in-out"
        }}
      >
        <ResultsPanel view={view} isVisible={showResults} />
      </div>

      {/* AI Query Panel */}
      {showAiQuery && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: 0,
            bottom: 0,
            width: 520,
            background: "white",
            boxShadow: "2px 0 8px rgba(0,0,0,0.2)",
            zIndex: 998,
            overflow: "auto",
            transition: "left 0.3s ease-in-out"
          }}
        >
          <AiQueryPanel view={view} />
        </div>
      )}
    </div>
  );
}
