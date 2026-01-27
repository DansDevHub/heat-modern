import { useEffect, useRef, useState } from "react";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import LayerList from "@arcgis/core/widgets/LayerList";
import Legend from "@arcgis/core/widgets/Legend";
import ResultsPanel from "../features/results/ResultsPanel";
import AiQueryPanel from "../features/aiQuery/AiQueryPanel";

interface HeaderProps {
  view: any;
}

// Contact information data
const CONTACT_INFO = [
  { category: "Special Needs Shelter Registration", agency: "Florida Department of Health", phone: "(813) 307-8063", website: "HCFLGov.net/StaySafe" },
  { category: "General information and assistance", agency: "Hillsborough County Customer Service Call Center", phone: "(813) 272-5900", website: "HCFLGov.net/StaySafe" },
  { category: "Pet information", agency: "Hillsborough County Pet Resource Center", phone: "(813) 744-5660", website: "HCFLGov.net/StaySafe" },
  { category: "Building and development information", agency: "Hillsborough County Development Services", phone: "(813) 272-5600", website: "HCFLGov.net/StaySafe" },
  { category: "Solid waste information", agency: "Hillsborough County Solid Waste", phone: "(813) 272-5680", website: "HCFLGov.net/StaySafe" },
  { category: "Business preparation and assistance", agency: "Hillsborough County Economic Development", phone: "(813) 204-9267", website: "HCFLGov.net/StaySafe" },
  { category: "Law enforcement information", agency: "Florida Highway Patrol", phone: "(813) 558-1800", website: "Flhsmv.gov" },
  { category: "Law enforcement information", agency: "Hillsborough County Sheriff's Office", phone: "(813) 247-8000", website: "Teamhcso.com" },
  { category: "Law enforcement information", agency: "Tampa Police Department", phone: "(813) 276-3200", website: "Tampa.gov/Police" },
  { category: "Law enforcement information", agency: "Plant City Police Department", phone: "(813) 757-9200", website: "PlantCityGov.com/Police" },
  { category: "Law enforcement information", agency: "Temple Terrace Police Department", phone: "(813) 506-6500", website: "TempleTerrace.gov/171/Police-Department" },
  { category: "Communications and internet information", agency: "Frontier", phone: "(800) 239-4430", website: "Frontier.com" },
  { category: "Communications and internet information", agency: "Spectrum", phone: "(800) 267-6094", website: "Spectrum.com" },
  { category: "Natural gas utilities", agency: "TECO Peoples Gas", phone: "(877) 832-6747", website: "Peoplegas.com" },
  { category: "Electric utilities", agency: "TECO", phone: "(877) 588-1010", website: "Tecoenergy.com" },
  { category: "Crisis counseling and service referral information", agency: "Crisis Center of Tampa Bay", phone: "211", website: "Crisiscenter.com" },
  { category: "Crisis counseling and service referral information", agency: "American Red Cross", phone: "(813) 348-4820", website: "Redcross.org" },
  { category: "Crisis counseling and service referral information", agency: "Catholic Charities", phone: "(813) 631-4370", website: "Ccdosp.org" },
  { category: "Crisis counseling and service referral information", agency: "Salvation Army", phone: "(813) 226-0055", website: "Salvationarmyflorida.org/tampa" },
  { category: "Business preparation and assistance", agency: "Business Disaster Hotline", phone: "(813) 301-7458", website: null },
  { category: "Transit and emergency transportation information", agency: "Hillsborough Area Regional Transit (HART)", phone: "(813) 254-4278", website: "GoHART.org" },
  { category: "Drainage issues, street flooding, or other flooding issues", agency: "Hillsborough County Public Works", phone: "(813) 635-5400", website: "HCFLGov.net/AtYourService" },
];

export default function Header({ view }: HeaderProps) {
  const basemapContainerRef = useRef<HTMLDivElement | null>(null);
  const layerListContainerRef = useRef<HTMLDivElement | null>(null);
  const legendContainerRef = useRef<HTMLDivElement | null>(null);
  const [showBasemap, setShowBasemap] = useState(false);
  const [showLayers, setShowLayers] = useState(false); // Default to hidden
  const [showLegend, setShowLegend] = useState(true); // Default to visible
  const [showResults, setShowResults] = useState(false);
  const [showAiQuery, setShowAiQuery] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

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

  // Create Legend widget when view is ready (panel is always mounted)
  useEffect(() => {
    if (!view || !legendContainerRef.current) return;

    let legend: InstanceType<typeof Legend> | null = null;

    // Wait for view to be fully ready before creating Legend
    view.when(() => {
      if (legendContainerRef.current) {
        legend = new Legend({
          view: view,
          container: legendContainerRef.current
        });
      }
    });

    return () => {
      if (legend) {
        legend.destroy();
      }
    };
  }, [view]);

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
        {/* Information Links */}
        <div style={{ marginLeft: 48, display: "flex", gap: 24, alignItems: "center" }}>
          <button
            onClick={() => setShowAlerts(true)}
            style={{
              background: "none",
              border: "none",
              color: "white",
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0
            }}
            title="HCFL Alerts"
          >
            HCFL Alerts
          </button>
          <a
            href="https://hcfl.gov/residents/public-safety/emergency-management/hurricane-and-tropical-storm-preparedness"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "none",
              border: "none",
              color: "white",
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
              fontFamily: "inherit"
            }}
          >
            Hurricane Preparedness
          </a>
          <a
            href="https://hcfl.gov/assets/blt43ba4f996ab09b90/file"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "none",
              border: "none",
              color: "white",
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
              fontFamily: "inherit"
            }}
          >
            Disaster Guide (English)
          </a>
          <a
            href="https://hcfl.gov/assets/bltd66bfb2b24cf5464/file"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "none",
              border: "none",
              color: "white",
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
              fontFamily: "inherit"
            }}
          >
            Disaster Guide (Spanish)
          </a>
          <button
            onClick={() => setShowContacts(true)}
            style={{
              background: "none",
              border: "none",
              color: "white",
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0
            }}
          >
            Important Contacts
          </button>
        </div>
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

      {/* Legend Panel - Pinned to right side */}
      <div
        style={{
          position: "fixed",
          top: 75, // 60px header + 15px padding to match home button
          right: showLegend ? 15 : -280,
          width: 250,
          background: "white",
          borderRadius: 4,
          boxShadow: "-2px 0 8px rgba(0,0,0,0.2)",
          zIndex: 999,
          transition: "right 0.3s ease-in-out",
          maxHeight: "calc(100vh - 95px)",
          overflow: "auto"
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            background: brandBlue,
            color: "white",
            fontWeight: 600,
            fontSize: 13,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4
          }}
        >
          Legend
        </div>
        <div
          ref={legendContainerRef}
          style={{
            padding: 8
          }}
        />
      </div>

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

      {/* HCFL Alerts Modal */}
      {showAlerts && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onClick={() => setShowAlerts(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                background: brandBlue,
                color: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                HCFL Alerts
              </h2>
              <button
                onClick={() => setShowAlerts(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 24,
                  padding: 0,
                  lineHeight: 1
                }}
                title="Close"
              >
                ×
              </button>
            </div>
            {/* Modal Content */}
            <div style={{ padding: 0 }}>
              <a
                href="https://member.everbridge.net/1332612387832180/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="/assets/hcfl-alerts.png"
                  alt="Sign up for HCFL Alerts"
                  style={{ display: "block", maxWidth: "100%", height: "auto" }}
                />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Important Contacts Modal */}
      {showContacts && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onClick={() => setShowContacts(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              maxWidth: "90vw",
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                background: brandBlue,
                color: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                Important Contact Information
              </h2>
              <button
                onClick={() => setShowContacts(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 24,
                  padding: 0,
                  lineHeight: 1
                }}
                title="Close"
              >
                ×
              </button>
            </div>
            {/* Modal Content */}
            <div style={{ overflow: "auto", padding: 20, color: "#333" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                  color: "#333"
                }}
              >
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: `2px solid ${brandBlue}`, fontWeight: 600 }}>
                      Disaster Related Information
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: `2px solid ${brandBlue}`, fontWeight: 600 }}>
                      Department / Agency
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: `2px solid ${brandBlue}`, fontWeight: 600 }}>
                      Phone Number
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: `2px solid ${brandBlue}`, fontWeight: 600 }}>
                      Website
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CONTACT_INFO.map((contact, index) => (
                    <tr
                      key={index}
                      style={{ background: index % 2 === 0 ? "white" : "#fafafa" }}
                    >
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e0e0e0" }}>
                        {contact.category}
                      </td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e0e0e0" }}>
                        {contact.agency}
                      </td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e0e0e0", whiteSpace: "nowrap" }}>
                        <a
                          href={`tel:${contact.phone.replace(/[^0-9]/g, "")}`}
                          style={{ color: brandBlue, textDecoration: "none" }}
                        >
                          {contact.phone}
                        </a>
                      </td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e0e0e0" }}>
                        {contact.website ? (
                          <a
                            href={`https://${contact.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: brandBlue, textDecoration: "none" }}
                          >
                            {contact.website}
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
