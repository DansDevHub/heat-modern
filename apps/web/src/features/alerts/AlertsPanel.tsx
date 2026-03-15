// apps/web/src/features/alerts/AlertsPanel.tsx

import { useState, useEffect, useRef } from "react";
import Point from "@arcgis/core/geometry/Point";
import { API_BASE } from "../../utils/apiBase";

interface Alert {
  StormName: string;
  Message: string;
  Severity: "info" | "warning" | "critical";
  StartTime: number | null;
  EndTime: number | null;
  EditDate: number | null;
}

interface Shelter {
  shelter_na: string;
  address: string;
  status: string;
  capacity: number;
  occupancy: number;
  pet_friend: string;
  special_ne?: string;
  _geometry?: { x: number; y: number; spatialReference?: { wkid: number } };
  [key: string]: any;
}

interface AlertsPanelProps {
  view?: any;
  isVisible?: boolean;
  onLatestAlert?: (alert: Alert | null) => void;
}

export type { Alert };

const brandBlue = "#054173";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  critical: { bg: "#f8d7da", border: "#f5c6cb", color: "#721c24", label: "CRITICAL" },
  warning:  { bg: "#fff3cd", border: "#ffc107", color: "#856404", label: "WARNING" },
  info:     { bg: "#d4edda", border: "#c3e6cb", color: "#155724", label: "INFO" },
};

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

export default function AlertsPanel({ view, isVisible = true, onLatestAlert }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);

  async function fetchAlerts() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/alerts`);
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch alerts");
      }
      setAlerts(data.alerts ?? []);
      setShelters(data.shelters ?? []);
      setLastFetched(new Date());
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch alerts");
    } finally {
      setLoading(false);
    }
  }

  // Fetch on mount and when panel becomes visible; poll on interval
  useEffect(() => {
    if (!isVisible) return;

    fetchAlerts();

    intervalRef.current = window.setInterval(fetchAlerts, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isVisible]);

  function formatDate(epoch: number | null) {
    if (!epoch) return "";
    return new Date(epoch).toLocaleString();
  }

  // Show only the single most recent alert (already sorted by severity then EditDate DESC)
  const latestAlert = alerts.length > 0 ? alerts[0] : null;

  useEffect(() => {
    onLatestAlert?.(latestAlert);
  }, [latestAlert, onLatestAlert]);

  function zoomToShelter(shelter: Shelter) {
    if (!view || !shelter._geometry) return;

    const point = new Point({
      x: shelter._geometry.x,
      y: shelter._geometry.y,
      spatialReference: { wkid: 102100 }
    });

    view.goTo({ target: point, zoom: 16 }, { duration: 800 }).then(() => {
      view.popup.open({
        title: shelter.shelter_na,
        content:
          `<b>Address:</b> ${shelter.address}<br/>` +
          `<b>Status:</b> ${shelter.status}<br/>` +
          `<b>Pet Friendly:</b> ${shelter.pet_friend}<br/>` +
          `<b>Available Spaces:</b> ${shelter.capacity - shelter.occupancy} of ${shelter.capacity}`,
        location: point
      });
    }).catch(() => {});
  }

  return (
    <div style={{ padding: 12, color: "#000", height: "100%", display: "flex", flexDirection: "column" }}>
      <h2 style={{ margin: "8px 0 12px 0", color: "#000" }}>Alerts &amp; Information</h2>

      {/* Last updated */}
      {lastFetched && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Updated {lastFetched.toLocaleTimeString()}</span>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            style={{
              background: "none",
              border: "1px solid #ddd",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              cursor: loading ? "not-allowed" : "pointer",
              color: "#666"
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !lastFetched && (
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
            Loading alerts...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
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
          <div style={{ color: "#721c24", marginTop: 4 }}>{error}</div>
        </div>
      )}

      {/* Alerts list */}
      {!loading && !error && alerts.length === 0 && lastFetched && (
        <div style={{ padding: 20, textAlign: "center", color: "#666", fontSize: 13 }}>
          No active alerts at this time.
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Latest alert */}
        {latestAlert && (() => {
          const style = SEVERITY_STYLES[latestAlert.Severity] ?? SEVERITY_STYLES.info;
          const stormName = latestAlert.StormName || "General";
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontWeight: 600,
                fontSize: 15,
                color: brandBlue,
                marginBottom: 8,
                paddingBottom: 4,
                borderBottom: `2px solid ${brandBlue}`
              }}>
                {stormName}
              </div>

              <div
                style={{
                  padding: 12,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  borderRadius: 4,
                  marginBottom: 8
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    background: style.border,
                    color: style.color
                  }}>
                    {style.label}
                  </span>
                  {latestAlert.StartTime && (
                    <span style={{ fontSize: 11, color: style.color, opacity: 0.8 }}>
                      {formatDate(latestAlert.StartTime)}
                    </span>
                  )}
                </div>
                <div style={{ color: style.color, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {latestAlert.Message}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Open Shelters Table */}
        {lastFetched && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontWeight: 600,
              fontSize: 15,
              color: brandBlue,
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: `2px solid ${brandBlue}`
            }}>
              Open Shelters ({shelters.length})
            </div>

            {shelters.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, color: "#666", textAlign: "center" }}>
                No shelters are currently open.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={{ padding: "8px 6px", textAlign: "left", borderBottom: "2px solid #ddd", fontWeight: 600 }}>Shelter</th>
                    <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "2px solid #ddd", fontWeight: 600, whiteSpace: "nowrap" }}>Pet Friendly</th>
                    <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "2px solid #ddd", fontWeight: 600 }}>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {shelters.map((shelter, idx) => {
                    const available = shelter.capacity - shelter.occupancy;
                    const pctFull = shelter.capacity > 0 ? shelter.occupancy / shelter.capacity : 0;
                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? "white" : "#fafafa" }}>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid #eee" }}>
                          <button
                            onClick={() => zoomToShelter(shelter)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              color: brandBlue,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: shelter._geometry ? "pointer" : "default",
                              textDecoration: "underline",
                              textAlign: "left"
                            }}
                          >
                            {shelter.shelter_na}
                          </button>
                          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{shelter.address}</div>
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid #eee" }}>
                          {shelter.pet_friend === "Yes" ? (
                            <span style={{ color: "#28a745", fontWeight: 600 }}>Yes</span>
                          ) : (
                            <span style={{ color: "#999" }}>No</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid #eee" }}>
                          <div style={{
                            fontWeight: 600,
                            color: pctFull >= 0.9 ? "#dc3545" : pctFull >= 0.7 ? "#856404" : "#28a745"
                          }}>
                            {available}
                          </div>
                          <div style={{ fontSize: 10, color: "#999" }}>of {shelter.capacity}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
