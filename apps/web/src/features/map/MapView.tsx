import { useEffect, useRef } from "react";

import esriConfig from "@arcgis/core/config";
import EsriMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebMap from "@arcgis/core/WebMap";
import Portal from "@arcgis/core/portal/Portal";

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import Home from "@arcgis/core/widgets/Home";
import Locate from "@arcgis/core/widgets/Locate";
import Measurement from "@arcgis/core/widgets/Measurement";

import Polygon from "@arcgis/core/geometry/Polygon";
import Point from "@arcgis/core/geometry/Point";
import Extent from "@arcgis/core/geometry/Extent";

import { useResultsStore } from "../results/state";

async function loadConfig() {
  const resp = await fetch("/config/config.json");
  if (!resp.ok) throw new Error("Missing /public/config/config.json");
  return (await resp.json()) as any;
}

interface MapViewComponentProps {
  onViewReady?: (view: MapView) => void;
}

export default function MapViewComponent({ onViewReady }: MapViewComponentProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const selectionGraphicRef = useRef<Graphic | null>(null);
  const { setLastClick, results } = useResultsStore();

  useEffect(() => {
    let canceled = false;

    (async () => {
      const cfg = await loadConfig();
      const portalUrl = cfg?.map?.portalUrl ?? "https://www.arcgis.com";
      const itemId = cfg?.map?.itemId;

      let map: EsriMap | WebMap;
      if (itemId) {
        // Check if this is ArcGIS Online (including organization URLs) or Enterprise Portal
        const isAGOL = portalUrl.includes(".arcgis.com");

        if (isAGOL) {
          // ArcGIS Online - use default portal
          map = new WebMap({
            portalItem: {
              id: itemId
            }
          });
        } else {
          // Enterprise Portal - configure esriConfig and create Portal instance
          esriConfig.portalUrl = portalUrl;

          // Extract hostname and add to trusted servers for CORS
          const portalHost = new URL(portalUrl).hostname;
          esriConfig.request.trustedServers = esriConfig.request.trustedServers || [];
          if (!esriConfig.request.trustedServers.includes(portalHost)) {
            esriConfig.request.trustedServers.push(portalHost);
          }

          const portal = new Portal({ url: portalUrl });

          try {
            // Load portal to check connectivity
            await portal.load();
            console.log("Portal loaded successfully:", portal.name);
          } catch (err) {
            console.error("Failed to load portal:", err);
          }

          map = new WebMap({
            portalItem: {
              id: itemId,
              portal: portal
            }
          });
        }

        // Add error handling for WebMap loading
        try {
          await map.load();
          console.log("WebMap loaded successfully:", map.portalItem?.title);
        } catch (err) {
          console.error("Failed to load WebMap:", err);
        }
      } else {
        map = new EsriMap({ basemap: "streets-vector" });
      }

      // Add Parcels explicitly (debug + ensures visibility regardless of WebMap config)
      const parcels = new FeatureLayer({
        url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/HC_Parcels/MapServer/0",
        title: "Parcels",
        outFields: ["*"]
      });
      map.add(parcels);

      // Hillsborough County extent
      const hillsboroughExtent = new Extent({
        xmin: -82.9,
        ymin: 27.55,
        xmax: -82.0,
        ymax: 28.2,
        spatialReference: { wkid: 4326 }
      });

      const view = new MapView({
        map,
        container: divRef.current as HTMLDivElement,
        extent: hillsboroughExtent,
        ui: {
          padding: {
            top: 15  // Add spacing from the header
          }
        }
      });

      viewRef.current = view;

      // Add Home button widget to top-left (above zoom controls)
      const homeBtn = new Home({
        view: view
      });
      view.ui.add(homeBtn, {
        position: "top-left",
        index: 0
      });

      // Add Locate widget below zoom controls (uses device GPS)
      const locateBtn = new Locate({
        view: view,
        useHeadingEnabled: false,
        goToOverride: (view, options) => {
          // Zoom to a reasonable scale when locating
          options.target.scale = 5000;
          return view.goTo(options.target);
        }
      });
      view.ui.add(locateBtn, {
        position: "top-left",
        index: 2
      });

      // Add Measurement widget below Locate button
      const measurementWidget = new Measurement({
        view: view
      });
      view.ui.add(measurementWidget, {
        position: "top-left",
        index: 3
      });

      // Notify parent that view is ready
      if (onViewReady) {
        onViewReady(view);
      }

      view.on("click", async (ev) => {
        // Only handle parcel selection if the Results panel is active
        const panelActive = useResultsStore.getState().panelActive;
        if (!panelActive) return;

        // --- Hit test once ---
        const hit = await view.hitTest(ev);
        const parcelHit = hit.results.find(
          (r) => r.graphic?.layer?.title === "Parcels"
        );

        // --- Update Results (prefer folio) ---
        const folio = parcelHit?.graphic?.attributes?.FOLIO_NUMB;
        if (folio) {
          setLastClick({
            type: "folio",
            folio: String(folio)
          });
        } else {
          setLastClick({
            type: "point",
            point: {
              x: ev.mapPoint.x,
              y: ev.mapPoint.y,
              spatialReference: {
                wkid: ev.mapPoint.spatialReference.wkid
              }
            }
          });
        }

        // --- Clear previous highlight ---
        if (selectionGraphicRef.current) {
          view.graphics.remove(selectionGraphicRef.current);
          selectionGraphicRef.current = null;
        }

        // --- Highlight clicked parcel ---
        if (!parcelHit) return;

        const g = parcelHit.graphic.clone();
        g.symbol = new SimpleFillSymbol({
          style: "solid",
          color: [0, 0, 0, 0.15],
          outline: {
            color: [0, 0, 0, 1],
            width: 2
          }
        } as any);

        view.graphics.add(g);
        selectionGraphicRef.current = g;
      });

      if (canceled) {
        view.destroy();
      }
    })();

    return () => {
      canceled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [setLastClick]);

  // Zoom to results when parcel is found and highlight it, or clear selection when results are cleared
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // If results are cleared, remove the selection graphic
    if (!results?.parcel?.geometry) {
      if (selectionGraphicRef.current) {
        view.graphics.remove(selectionGraphicRef.current);
        selectionGraphicRef.current = null;
      }
      return;
    }

    const geom = results.parcel.geometry;

    // Create ArcGIS geometry from the result
    let targetGeometry;
    if (geom.rings) {
      // Polygon geometry
      targetGeometry = new Polygon({
        rings: geom.rings,
        spatialReference: geom.spatialReference || { wkid: 102100 }
      });
    } else if (geom.x !== undefined && geom.y !== undefined) {
      // Point geometry
      targetGeometry = new Point({
        x: geom.x,
        y: geom.y,
        spatialReference: geom.spatialReference || { wkid: 102100 }
      });
    }

    if (targetGeometry) {
      // Clear previous highlight
      if (selectionGraphicRef.current) {
        view.graphics.remove(selectionGraphicRef.current);
        selectionGraphicRef.current = null;
      }

      // Add highlight graphic for polygon geometries
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
          } as any)
        });
        view.graphics.add(highlightGraphic);
        selectionGraphicRef.current = highlightGraphic;
      }

      // Zoom to the parcel
      view.goTo({
        target: targetGeometry,
        scale: 2400  // Good scale for viewing parcels (instead of zoom level)
      }).catch((err) => {
        // Ignore goTo errors (e.g., if animation was cancelled)
        if (err.name !== "AbortError") {
          console.warn("Error zooming to parcel:", err);
        }
      });
    }
  }, [results]);

  return <div ref={divRef} style={{ position: "absolute", inset: 0 }} />;
}
