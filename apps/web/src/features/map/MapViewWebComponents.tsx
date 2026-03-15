import { useEffect, useRef, useState } from "react";
import { useResultsStore } from "../results/state";

async function loadConfig() {
  const resp = await fetch(`${import.meta.env.BASE_URL}config/config.json`);
  if (!resp.ok) throw new Error("Missing /public/config/config.json");
  return (await resp.json()) as any;
}

interface MapViewComponentProps {
  onViewReady?: (view: any) => void;
}

export default function MapViewWebComponents({ onViewReady }: MapViewComponentProps) {
  const mapRef = useRef<any>(null);
  const { setLastClick, results } = useResultsStore();
  const [measurementWidgets, setMeasurementWidgets] = useState<any>(null);
  const isMeasuringRef = useRef(false);

  useEffect(() => {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    let view: any = null;
    let measurementHandles: any[] = [];

    const initMap = async () => {
      try {
        console.log("Initializing map...");
        const cfg = await loadConfig();
        const itemId = cfg?.map?.itemId;
        const portalUrl = cfg?.map?.portalUrl;
        console.log("Config loaded:", { itemId, portalUrl });

        // Set map properties
        // IMPORTANT: portalUrl must be set BEFORE itemId for Enterprise Portal webmaps
        if (itemId) {
          if (portalUrl && portalUrl !== "https://www.arcgis.com") {
            console.log("Setting portalUrl first:", portalUrl);
            mapElement.portalUrl = portalUrl;
          }
          console.log("Setting itemId:", itemId);
          mapElement.itemId = itemId;
        } else {
          mapElement.basemap = "streets-vector";
        }

        mapElement.center = "-82.46,27.95";
        mapElement.zoom = 10;
        console.log("Map properties set");

        // Listen for view ready event
        const handleViewReady = async (event: any) => {
          console.log("View ready event fired!");
          view = event.target.view;

          if (!view) {
            console.error("View is null");
            return;
          }

          console.log("View obtained:", view);

          // Add Parcels layer
          const { default: FeatureLayer } = await import("@arcgis/core/layers/FeatureLayer");
          const parcelsLayer = new FeatureLayer({
            url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/HC_Parcels/MapServer/0",
            title: "Parcels",
            outFields: ["*"]
          });
          view.map.add(parcelsLayer);
          console.log("Parcels layer added");

          // Create measurement widgets (but don't add to UI)
          const { default: AreaMeasurement2D } = await import("@arcgis/core/widgets/AreaMeasurement2D");
          const { default: DistanceMeasurement2D } = await import("@arcgis/core/widgets/DistanceMeasurement2D");

          const areaMeasurement = new AreaMeasurement2D({
            view,
            container: document.createElement("div"),
            unit: "imperial"
          });
          const distanceMeasurement = new DistanceMeasurement2D({
            view,
            container: document.createElement("div"),
            unit: "imperial"
          });

          // Watch for measurement state changes to auto-clear isMeasuring flag
          const areaHandle = areaMeasurement.viewModel.watch("state", (state) => {
            console.log("Area measurement state changed:", state);
            // When measurement completes, reset the flag
            if (state === "measured") {
              isMeasuringRef.current = false;
            }
          });

          const distanceHandle = distanceMeasurement.viewModel.watch("state", (state) => {
            console.log("Distance measurement state changed:", state);
            // When measurement completes, reset the flag
            if (state === "measured") {
              isMeasuringRef.current = false;
            }
          });

          measurementHandles.push(areaHandle, distanceHandle);

          const widgets = { areaMeasurement, distanceMeasurement };
          setMeasurementWidgets(widgets);
          console.log("Measurement widgets created");

          // Notify parent
          if (onViewReady) {
            onViewReady(view);
          }

          // Handle click events
          view.on("click", async (event: any) => {
            console.log("Map clicked! isMeasuring:", isMeasuringRef.current);

            // Don't trigger results if user has explicitly started a measurement
            if (isMeasuringRef.current) {
              console.log("Skipping results - measurement tool active");
              // Let the measurement widget handle the click
              return;
            }

            const response = await view.hitTest(event);
            console.log("Hit test response:", response);
            const parcelHit = response.results.find(
              (result: any) => result.graphic?.layer?.title === "Parcels"
            );

            console.log("Parcel hit:", parcelHit);

            const folio = parcelHit?.graphic?.attributes?.FOLIO_NUMB;
            if (folio) {
              console.log("Setting folio lookup:", folio);
              setLastClick({
                type: "folio",
                folio: String(folio)
              });
            } else {
              console.log("Setting point lookup:", event.mapPoint);
              setLastClick({
                type: "point",
                point: {
                  x: event.mapPoint.x,
                  y: event.mapPoint.y,
                  spatialReference: {
                    wkid: event.mapPoint.spatialReference.wkid
                  }
                }
              });
            }
          });
        };

        // Add event listener
        mapElement.addEventListener("arcgisViewReadyChange", handleViewReady);

        return () => {
          mapElement.removeEventListener("arcgisViewReadyChange", handleViewReady);
          // Clean up measurement watchers
          measurementHandles.forEach(handle => handle?.remove());
        };
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    initMap();
  }, [setLastClick, onViewReady]);

  // Handle zoom to results
  useEffect(() => {
    const mapElement = mapRef.current;
    if (!mapElement || !results?.parcel?.geometry) return;

    const zoomToParcel = async () => {
      // Access the view from the map element
      const view = mapElement.view;
      if (!view) {
        console.log("View not ready yet for zoom");
        return;
      }

      const geom = results.parcel.geometry;

      // Import geometry classes
      const { default: Polygon } = await import("@arcgis/core/geometry/Polygon");
      const { default: Point } = await import("@arcgis/core/geometry/Point");
      const { default: Graphic } = await import("@arcgis/core/Graphic");
      const { default: SimpleFillSymbol } = await import("@arcgis/core/symbols/SimpleFillSymbol");

      let targetGeometry;
      if (geom.rings) {
        targetGeometry = new Polygon({
          rings: geom.rings,
          spatialReference: geom.spatialReference || { wkid: 102100 }
        });
      } else if (geom.x !== undefined && geom.y !== undefined) {
        targetGeometry = new Point({
          x: geom.x,
          y: geom.y,
          spatialReference: geom.spatialReference || { wkid: 102100 }
        });
      }

      if (targetGeometry) {
        // Clear previous graphics
        view.graphics.removeAll();

        // Add highlight for polygons
        if (geom.rings) {
          const highlightGraphic = new Graphic({
            geometry: targetGeometry,
            symbol: new SimpleFillSymbol({
              style: "solid",
              color: [0, 0, 0, 0.15],
              outline: {
                color: [0, 0, 0, 1],
                width: 2
              }
            })
          });
          view.graphics.add(highlightGraphic);
        }

        // Zoom to the geometry
        view.goTo({
          target: targetGeometry,
          scale: 2400
        }).catch((err: any) => {
          if (err.name !== "AbortError") {
            console.warn("Error zooming to parcel:", err);
          }
        });
      }
    };

    zoomToParcel();
  }, [results]);

  const handleAreaMeasurement = () => {
    if (measurementWidgets?.areaMeasurement && measurementWidgets?.distanceMeasurement) {
      // Clear the other tool first
      measurementWidgets.distanceMeasurement.viewModel.clear();

      // Start area measurement and mark as measuring
      isMeasuringRef.current = true;
      measurementWidgets.areaMeasurement.viewModel.start();
    }
  };

  const handleDistanceMeasurement = () => {
    if (measurementWidgets?.areaMeasurement && measurementWidgets?.distanceMeasurement) {
      // Clear the other tool first
      measurementWidgets.areaMeasurement.viewModel.clear();

      // Start distance measurement and mark as measuring
      isMeasuringRef.current = true;
      measurementWidgets.distanceMeasurement.viewModel.start();
    }
  };

  const handleClearMeasurements = () => {
    if (measurementWidgets?.areaMeasurement && measurementWidgets?.distanceMeasurement) {
      measurementWidgets.areaMeasurement.viewModel.clear();
      measurementWidgets.distanceMeasurement.viewModel.clear();

      // Mark as not measuring so map clicks work again
      isMeasuringRef.current = false;
    }
  };

  return (
    <>
      <arcgis-map ref={mapRef} style={{ position: "absolute", inset: 0 }}>
        <arcgis-home position="top-left"></arcgis-home>
        <arcgis-zoom position="top-left"></arcgis-zoom>
      </arcgis-map>

      {/* Custom measurement buttons */}
      <div style={{ position: "absolute", top: "15px", left: "15px", display: "flex", flexDirection: "column", gap: "0px", pointerEvents: "none" }}>
        <div style={{ height: "32px" }}></div>
        <div style={{ height: "64px" }}></div>
        <div style={{ height: "20px" }}></div>
        <button
          onClick={handleAreaMeasurement}
          disabled={!measurementWidgets}
          className="esri-widget esri-widget--button"
          style={{
            width: "32px",
            height: "32px",
            padding: "0",
            margin: "0 0 10px 0",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            outline: "none"
          }}
          title="Area Measurement"
        >
          <span className="esri-icon-measure-area" style={{ fontSize: "16px" }}></span>
        </button>
        <button
          onClick={handleDistanceMeasurement}
          disabled={!measurementWidgets}
          className="esri-widget esri-widget--button"
          style={{
            width: "32px",
            height: "32px",
            padding: "0",
            margin: "0 0 10px 0",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            outline: "none"
          }}
          title="Distance Measurement"
        >
          <span className="esri-icon-measure-line" style={{ fontSize: "16px" }}></span>
        </button>
        <button
          onClick={handleClearMeasurements}
          disabled={!measurementWidgets}
          className="esri-widget esri-widget--button"
          style={{
            width: "32px",
            height: "32px",
            padding: "0",
            margin: "0",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            outline: "none"
          }}
          title="Clear Measurements"
        >
          <span className="esri-icon-trash" style={{ fontSize: "16px" }}></span>
        </button>
      </div>
    </>
  );
}
