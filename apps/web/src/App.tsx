import { useState } from "react";

import Header from "./components/Header";
import MapViewComponent from "./features/map/MapView";

export default function App() {
  const [mapView, setMapView] = useState<any>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header view={mapView} />
      <div style={{ flex: 1, position: "relative" }}>
        <MapViewComponent onViewReady={setMapView} />
      </div>
    </div>
  );
}
