import { useCallback, useRef, useState } from "react";

import Header from "./components/Header";
import MapViewComponent from "./features/map/MapView";

export default function App() {
  const [mapView, setMapView] = useState<any>(null);
  const homeResetListenersRef = useRef<Array<() => void>>([]);

  const onHomeReset = useCallback(() => {
    homeResetListenersRef.current.forEach((fn) => fn());
  }, []);

  const registerHomeReset = useCallback((fn: () => void) => {
    homeResetListenersRef.current.push(fn);
    return () => {
      homeResetListenersRef.current = homeResetListenersRef.current.filter((f) => f !== fn);
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header view={mapView} onHomeReset={registerHomeReset} />
      <div style={{ height: 60, flexShrink: 0 }} />
      <div style={{ flex: 1, position: "relative" }}>
        <MapViewComponent onViewReady={setMapView} onHomeReset={onHomeReset} />
      </div>
    </div>
  );
}
