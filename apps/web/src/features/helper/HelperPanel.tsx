// apps/web/src/features/helper/HelperPanel.tsx

import { useState, useRef, useEffect } from "react";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";

interface HelperPanelProps {
  view: any;
  isVisible?: boolean;
}

type Suggestion = { text: string; magicKey?: string; isCollection?: boolean };

type FlowType = "menu" | "evacuation" | "shelter" | "fullInfo";

interface Message {
  id: string;
  type: "bot" | "user" | "info" | "error" | "shelter-list";
  content: string;
  options?: Array<{ label: string; value: string; description?: string }>;
  checkboxes?: Array<{ label: string; value: string; checked?: boolean }>;
  shelters?: Shelter[];
}

interface Shelter {
  shelter_na: string;
  address: string;
  status: string;
  capacity: number;
  occupancy: number;
  pet_friend: string;
  spns_frien?: string;
  ada_access?: string;
  DISTANCE_MILES?: number;
  _geometry?: {
    x: number;
    y: number;
    spatialReference?: { wkid: number };
  };
}

interface CollectedData {
  address: string;
  geocodedAddress?: string;
  geocodedGeometry?: { x: number; y: number; spatialReference?: { wkid: number } };
  zone?: string;
  zoneStatus?: string;
  shelterFilters: {
    pets: boolean;
    specialNeeds: boolean;
    ada: boolean;
    openOnly: boolean;
  };
  shelters?: Shelter[];
}

// Hillsborough County brand colors
const brandBlue = "#054173";
const brandOrange = "#FF6F5B";

export default function HelperPanel({ view, isVisible = true }: HelperPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentFlow, setCurrentFlow] = useState<FlowType>("menu");
  const [currentStep, setCurrentStep] = useState(0);
  const [collectedData, setCollectedData] = useState<CollectedData>({
    address: "",
    shelterFilters: { pets: false, specialNeeds: false, ada: false, openOnly: false }
  });
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState<"address" | "option" | "checkbox" | null>(null);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (isVisible && messages.length === 0) {
      showMainMenu();
    }
  }, [isVisible]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean up graphics when hidden
  useEffect(() => {
    if (!isVisible) {
      clearGraphics();
    }
    return () => {
      if (graphicsLayerRef.current && view?.map) {
        view.map.remove(graphicsLayerRef.current);
        graphicsLayerRef.current = null;
      }
    };
  }, [isVisible, view]);

  function addMessage(msg: Omit<Message, "id">) {
    const newMsg: Message = { ...msg, id: Date.now().toString() + Math.random() };
    setMessages((prev) => [...prev, newMsg]);
  }

  function showMainMenu() {
    setCurrentFlow("menu");
    setCurrentStep(0);
    setMessages([]);
    setCollectedData({
      address: "",
      shelterFilters: { pets: false, specialNeeds: false, ada: false, openOnly: false }
    });
    clearGraphics();

    addMessage({
      type: "bot",
      content: "How can I help you today?",
      options: [
        { label: "Find my evacuation zone", value: "evacuation", description: "Look up your zone by address" },
        { label: "Find a shelter", value: "shelter", description: "Search for nearby shelters" },
        { label: "Check shelter status", value: "shelter-status", description: "See current shelter availability" },
        { label: "I have an address and need all info", value: "fullInfo", description: "Get complete evacuation and shelter info" }
      ]
    });
    setWaitingForInput("option");
  }

  function handleOptionSelect(value: string) {
    // Add user's selection as a message
    const selectedOption = messages[messages.length - 1]?.options?.find((o) => o.value === value);
    if (selectedOption) {
      addMessage({ type: "user", content: selectedOption.label });
    }

    setWaitingForInput(null);

    switch (value) {
      case "evacuation":
        startEvacuationFlow();
        break;
      case "shelter":
      case "shelter-status":
        startShelterFlow(value === "shelter-status");
        break;
      case "fullInfo":
        startFullInfoFlow();
        break;
      case "yes-find-shelter":
        // From evacuation flow, user wants to find shelter
        startShelterFlow(false, true);
        break;
      case "no-done":
        addMessage({
          type: "bot",
          content: "Stay safe! You can return anytime for updated information."
        });
        setTimeout(() => {
          addMessage({
            type: "bot",
            content: "Is there anything else I can help you with?",
            options: [
              { label: "Start over", value: "restart" },
              { label: "I'm all set", value: "close" }
            ]
          });
          setWaitingForInput("option");
        }, 1000);
        break;
      case "restart":
        showMainMenu();
        break;
      case "close":
        addMessage({ type: "bot", content: "Thank you! Stay safe during hurricane season. 🌀" });
        break;
      case "search-again":
        // Reset and start shelter flow again
        setCollectedData((prev) => ({ ...prev, shelters: undefined }));
        startShelterFlow(false, false);
        break;
      case "open-only":
        searchShelters(true);
        break;
      case "show-all":
        searchShelters(false);
        break;
      case "show-directions":
        // Show directions options for existing shelters
        if (collectedData.shelters && collectedData.shelters.length > 0) {
          const shelterOptions = collectedData.shelters.map((s: Shelter, idx: number) => ({
            label: `Get directions to ${s.shelter_na}`,
            value: `shelter-${idx}`
          }));
          addMessage({
            type: "bot",
            content: "Which shelter would you like directions to?",
            options: [
              ...shelterOptions,
              { label: "Start over", value: "restart" }
            ]
          });
          setWaitingForInput("option");
        }
        break;
      default:
        // Handle shelter selection for directions
        if (value.startsWith("shelter-")) {
          const shelterIndex = parseInt(value.replace("shelter-", ""));
          if (collectedData.shelters && collectedData.shelters[shelterIndex]) {
            getDirectionsToShelter(collectedData.shelters[shelterIndex]);
          }
        }
        break;
    }
  }

  // ===== EVACUATION FLOW =====
  function startEvacuationFlow() {
    setCurrentFlow("evacuation");
    setCurrentStep(1);

    addMessage({
      type: "bot",
      content: "I can help you find your evacuation zone.\n\nPlease enter your address (street, city, state/zip):"
    });
    setWaitingForInput("address");
  }

  async function lookupEvacuationZone(address: string) {
    setIsLoading(true);
    addMessage({ type: "user", content: address });

    try {
      // First geocode the address
      const geocodeResp = await fetch("/api/geocode/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address })
      });
      const geocodeData = await geocodeResp.json();

      if (!geocodeData.candidates || geocodeData.candidates.length === 0) {
        addMessage({
          type: "error",
          content: "I couldn't find that address. Please check the format and try again, or try a nearby intersection."
        });
        setWaitingForInput("address");
        setIsLoading(false);
        return;
      }

      const location = geocodeData.candidates[0];
      setCollectedData((prev) => ({
        ...prev,
        address,
        geocodedAddress: location.address,
        geocodedGeometry: location.location
      }));

      // Query evacuation zone
      const zoneResp = await fetch("/api/identify/zone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: location.location.x,
          y: location.location.y,
          spatialReference: location.location.spatialReference?.wkid || 102100
        })
      });
      const zoneData = await zoneResp.json();

      if (zoneData.zone) {
        setCollectedData((prev) => ({
          ...prev,
          zone: zoneData.zone,
          zoneStatus: zoneData.status
        }));

        let zoneMessage = `Your address at **${location.address}** is in **Evacuation Zone ${zoneData.zone}**.`;

        if (zoneData.status === "mandatory") {
          zoneMessage += `\n\n⚠️ Zone ${zoneData.zone} is currently under **MANDATORY** evacuation order. You should evacuate immediately.`;
        } else if (zoneData.status === "voluntary") {
          zoneMessage += `\n\n⚡ Zone ${zoneData.zone} is currently under **VOLUNTARY** evacuation order. Consider evacuating, especially if you have special needs.`;
        } else {
          zoneMessage += `\n\n✓ There is no evacuation order for Zone ${zoneData.zone} at this time.`;
        }

        addMessage({ type: "info", content: zoneMessage });

        // Visualize on map
        visualizeLocation(location.location, location.address, zoneData.zone);

        // Offer next action
        setTimeout(() => {
          addMessage({
            type: "bot",
            content: "Would you like me to help you find a shelter near this location?",
            options: [
              { label: "Yes, find shelters", value: "yes-find-shelter" },
              { label: "No, I'm all set", value: "no-done" }
            ]
          });
          setWaitingForInput("option");
        }, 500);
      } else {
        addMessage({
          type: "info",
          content: `Your address at **${location.address}** does not appear to be in an evacuation zone. You may not need to evacuate, but always follow official guidance.`
        });
        setTimeout(() => {
          addMessage({
            type: "bot",
            content: "Is there anything else I can help you with?",
            options: [
              { label: "Find a shelter anyway", value: "yes-find-shelter" },
              { label: "Start over", value: "restart" }
            ]
          });
          setWaitingForInput("option");
        }, 500);
      }
    } catch (err) {
      addMessage({
        type: "error",
        content: "Sorry, there was an error looking up your evacuation zone. Please try again."
      });
      setWaitingForInput("address");
    } finally {
      setIsLoading(false);
    }
  }

  // ===== SHELTER FLOW =====
  function startShelterFlow(statusOnly: boolean = false, addressKnown: boolean = false) {
    setCurrentFlow("shelter");
    setCurrentStep(1);

    if (addressKnown && collectedData.geocodedAddress) {
      // We already have an address from evacuation flow
      addMessage({
        type: "bot",
        content: `I'll search for shelters near **${collectedData.geocodedAddress}**.\n\nDo any of these apply to you?`
      });
      showShelterFilters();
    } else {
      addMessage({
        type: "bot",
        content: "I'll help you find a shelter. First, what address should I search from?\n\n(This can be your home or current location)"
      });
      setWaitingForInput("address");
    }
  }

  function showShelterFilters() {
    addMessage({
      type: "bot",
      content: "Select all that apply:",
      checkboxes: [
        { label: "I have pets that need shelter", value: "pets" },
        { label: "I or someone in my party has special medical needs", value: "specialNeeds" },
        { label: "I need wheelchair/ADA accessible facilities", value: "ada" },
        { label: "None of these / Show all shelters", value: "none" }
      ]
    });
    setWaitingForInput("checkbox");
    setSelectedCheckboxes([]);
  }

  function handleCheckboxSubmit() {
    const filters = {
      pets: selectedCheckboxes.includes("pets"),
      specialNeeds: selectedCheckboxes.includes("specialNeeds"),
      ada: selectedCheckboxes.includes("ada"),
      openOnly: true // Default to open shelters
    };

    // Show what user selected
    const selections = [];
    if (filters.pets) selections.push("pets");
    if (filters.specialNeeds) selections.push("special medical needs");
    if (filters.ada) selections.push("ADA accessible");
    if (selections.length === 0) selections.push("no special requirements");

    addMessage({ type: "user", content: `Selected: ${selections.join(", ")}` });

    setCollectedData((prev) => ({ ...prev, shelterFilters: filters }));
    setWaitingForInput(null);

    // Ask about open vs all shelters
    addMessage({
      type: "bot",
      content: "Would you like to see:",
      options: [
        { label: "Only OPEN shelters with available space", value: "open-only" },
        { label: "All shelters (including full or not yet open)", value: "show-all" }
      ]
    });
    setWaitingForInput("option");
  }

  async function searchShelters(openOnly: boolean) {
    addMessage({ type: "user", content: openOnly ? "Only open shelters" : "Show all shelters" });
    setWaitingForInput(null);
    setIsLoading(true);

    const filters = { ...collectedData.shelterFilters, openOnly };
    setCollectedData((prev) => ({ ...prev, shelterFilters: filters }));

    try {
      // Build filter where clauses
      const filterClauses: string[] = [];
      if (filters.openOnly) filterClauses.push("status = 'Open'");
      if (filters.pets) filterClauses.push("pet_friend = 'Yes'");
      if (filters.specialNeeds) filterClauses.push("spns_frien = 'Yes'");

      const response = await fetch("/api/shelters/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: collectedData.geocodedAddress || collectedData.address,
          filters: filterClauses,
          nearest: true,
          maxResults: 5
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        addMessage({
          type: "error",
          content: data.error || "Sorry, there was an error searching for shelters."
        });
        setWaitingForInput("option");
        return;
      }

      if (data.shelters.length === 0) {
        addMessage({
          type: "info",
          content: "No shelters found matching your criteria. Try adjusting your filters."
        });
        addMessage({
          type: "bot",
          content: "What would you like to do?",
          options: [
            { label: "Search with different criteria", value: "search-again" },
            { label: "Start over", value: "restart" }
          ]
        });
        setWaitingForInput("option");
        return;
      }

      setCollectedData((prev) => ({ ...prev, shelters: data.shelters }));

      // Format shelter results
      let resultsContent = `Here are shelters matching your criteria, nearest first:\n\n`;

      data.shelters.forEach((shelter: Shelter, idx: number) => {
        const tags = [];
        if (shelter.pet_friend === "Yes") tags.push("🐾 Pet-friendly");
        if (shelter.spns_frien === "Yes") tags.push("🏥 Special needs");

        resultsContent += `**${idx + 1}. ${shelter.shelter_na}**`;
        if (shelter.DISTANCE_MILES) resultsContent += ` - ${shelter.DISTANCE_MILES.toFixed(1)} miles`;
        resultsContent += `\n`;
        resultsContent += `📍 ${shelter.address}\n`;
        resultsContent += `Status: ${shelter.status === "Open" ? "🟢 OPEN" : "🔴 " + shelter.status}`;
        resultsContent += ` | ${shelter.capacity - shelter.occupancy} spaces available\n`;
        if (tags.length > 0) resultsContent += `${tags.join(" | ")}\n`;
        resultsContent += `\n`;
      });

      addMessage({ type: "info", content: resultsContent });

      // Visualize on map
      visualizeShelters(data.shelters, data.geocodedLocation);

      // If only one shelter found, automatically get directions
      if (data.shelters.length === 1) {
        setIsLoading(false); // Reset loading before getting directions
        getDirectionsToShelter(data.shelters[0]);
        return;
      }

      // Multiple shelters - offer actions
      const shelterOptions = data.shelters.map((s: Shelter, idx: number) => ({
        label: `Get directions to ${s.shelter_na}`,
        value: `shelter-${idx}`
      }));

      addMessage({
        type: "bot",
        content: "Would you like directions to any of these shelters?",
        options: [
          ...shelterOptions,
          { label: "Search with different criteria", value: "search-again" },
          { label: "Start over", value: "restart" }
        ]
      });
      setWaitingForInput("option");
    } catch (err) {
      addMessage({
        type: "error",
        content: "Sorry, there was an error searching for shelters. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Handle option selections specific to shelter flow
  function handleShelterOptionSelect(value: string) {
    addMessage({ type: "user", content: value === "open-only" ? "Only open shelters" : "Show all shelters" });
    searchShelters(value === "open-only");
  }

  // ===== FULL INFO FLOW =====
  function startFullInfoFlow() {
    setCurrentFlow("fullInfo");
    setCurrentStep(1);

    addMessage({
      type: "bot",
      content: "I'll get you complete evacuation and shelter information.\n\nPlease enter your address:"
    });
    setWaitingForInput("address");
  }

  async function lookupFullInfo(address: string) {
    setIsLoading(true);
    addMessage({ type: "user", content: address });

    try {
      // Geocode the address
      const geocodeResp = await fetch("/api/geocode/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address })
      });
      const geocodeData = await geocodeResp.json();

      if (!geocodeData.candidates || geocodeData.candidates.length === 0) {
        addMessage({
          type: "error",
          content: "I couldn't find that address. Please check the format and try again."
        });
        setWaitingForInput("address");
        setIsLoading(false);
        return;
      }

      const location = geocodeData.candidates[0];
      setCollectedData((prev) => ({
        ...prev,
        address,
        geocodedAddress: location.address,
        geocodedGeometry: location.location
      }));

      // Query evacuation zone
      const zoneResp = await fetch("/api/identify/zone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: location.location.x,
          y: location.location.y,
          spatialReference: location.location.spatialReference?.wkid || 102100
        })
      });
      const zoneData = await zoneResp.json();

      // Search for shelters
      const shelterResp = await fetch("/api/shelters/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: location.address,
          filters: ["status = 'Open'"],
          nearest: true,
          maxResults: 3
        })
      });
      const shelterData = await shelterResp.json();

      // Build comprehensive response
      let fullInfoContent = `Here's what I found for **${location.address}**:\n\n`;

      // Evacuation status section
      fullInfoContent += `━━━ **EVACUATION STATUS** ━━━\n`;
      if (zoneData.zone) {
        fullInfoContent += `Zone: **${zoneData.zone}**\n`;
        if (zoneData.status === "mandatory") {
          fullInfoContent += `Current Status: ⚠️ **MANDATORY EVACUATION**\n`;
        } else if (zoneData.status === "voluntary") {
          fullInfoContent += `Current Status: ⚡ **VOLUNTARY EVACUATION**\n`;
        } else {
          fullInfoContent += `Current Status: ✓ No evacuation order\n`;
        }
      } else {
        fullInfoContent += `Not in an evacuation zone\n`;
      }
      fullInfoContent += `\n`;

      // Shelters section
      fullInfoContent += `━━━ **NEAREST OPEN SHELTERS** ━━━\n`;
      if (shelterData.success && shelterData.shelters?.length > 0) {
        shelterData.shelters.forEach((shelter: Shelter, idx: number) => {
          fullInfoContent += `${idx + 1}. **${shelter.shelter_na}**`;
          if (shelter.DISTANCE_MILES) fullInfoContent += ` - ${shelter.DISTANCE_MILES.toFixed(1)} mi`;
          fullInfoContent += `\n   📍 ${shelter.address}\n`;
          fullInfoContent += `   ${shelter.status === "Open" ? "🟢 OPEN" : "🔴 " + shelter.status}`;
          fullInfoContent += ` | ${shelter.capacity - shelter.occupancy} spaces\n`;
        });
        setCollectedData((prev) => ({ ...prev, shelters: shelterData.shelters }));
      } else {
        fullInfoContent += `No open shelters currently available\n`;
      }

      addMessage({ type: "info", content: fullInfoContent });

      // Visualize on map
      visualizeLocation(location.location, location.address, zoneData.zone);
      if (shelterData.success && shelterData.shelters?.length > 0) {
        visualizeShelters(shelterData.shelters, shelterData.geocodedLocation);
      }

      // Offer to filter shelters
      setTimeout(() => {
        addMessage({
          type: "bot",
          content: "Would you like to filter shelters by specific needs (pets, medical, accessibility)?",
          options: [
            { label: "Yes, filter shelters", value: "yes-find-shelter" },
            { label: "Get directions to a shelter", value: shelterData.shelters?.length > 0 ? "show-directions" : "restart" },
            { label: "Start over", value: "restart" }
          ]
        });
        setWaitingForInput("option");
      }, 500);
    } catch (err) {
      addMessage({
        type: "error",
        content: "Sorry, there was an error getting your information. Please try again."
      });
      setWaitingForInput("address");
    } finally {
      setIsLoading(false);
    }
  }

  // ===== DIRECTIONS =====
  async function getDirectionsToShelter(shelter: Shelter) {
    if (!shelter._geometry || !collectedData.geocodedAddress) return;

    addMessage({ type: "user", content: `Get directions to ${shelter.shelter_na}` });
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originAddress: collectedData.geocodedAddress,
          destinationName: `${shelter.shelter_na} - ${shelter.address}`,
          destinationCoords: { x: shelter._geometry.x, y: shelter._geometry.y }
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        addMessage({
          type: "error",
          content: "Sorry, I couldn't get directions. Please try again."
        });
        return;
      }

      const route = data.route;
      let directionsContent = `**Directions to ${shelter.shelter_na}**\n`;
      directionsContent += `📍 ${shelter.address}\n`;
      directionsContent += `🚗 ${route.totalDistance.toFixed(1)} miles • ~${Math.round(route.totalTime)} minutes\n\n`;

      route.directions.forEach((dir: any, idx: number) => {
        directionsContent += `${idx + 1}. ${dir.text}`;
        if (dir.length > 0) directionsContent += ` (${dir.length.toFixed(2)} mi)`;
        directionsContent += `\n`;
      });

      addMessage({ type: "info", content: directionsContent });

      // Draw route on map
      if (route.geometry?.paths && view) {
        // Ensure graphics layer exists
        if (!graphicsLayerRef.current) {
          const graphicsLayer = new GraphicsLayer({ title: "Helper Results" });
          view.map.add(graphicsLayer);
          graphicsLayerRef.current = graphicsLayer;
        }

        // Clear previous routes
        const routeGraphics = graphicsLayerRef.current.graphics.filter(
          (g: Graphic) => g.attributes?._isRoute
        );
        routeGraphics.forEach((g: Graphic) => graphicsLayerRef.current?.remove(g));

        // Draw the route line
        const routeGraphic = new Graphic({
          geometry: {
            type: "polyline",
            paths: route.geometry.paths,
            spatialReference: route.geometry.spatialReference || { wkid: 102100 }
          } as __esri.Polyline,
          symbol: new SimpleLineSymbol({
            color: [5, 65, 115, 1],
            width: 5,
            style: "solid"
          }),
          attributes: { _isRoute: true }
        });
        graphicsLayerRef.current.add(routeGraphic);

        // Add origin marker (if we have the geometry)
        if (data.origin?.geometry) {
          const originGraphic = new Graphic({
            geometry: {
              type: "point",
              x: data.origin.geometry.x,
              y: data.origin.geometry.y,
              spatialReference: { wkid: 102100 }
            } as __esri.Point,
            symbol: new SimpleMarkerSymbol({
              style: "diamond",
              color: [5, 65, 115, 0.9],
              size: 14,
              outline: { color: [255, 255, 255], width: 2 }
            }),
            attributes: { _isRoute: true, _type: "origin" }
          });
          graphicsLayerRef.current.add(originGraphic);
        }

        // Add destination marker
        const destGraphic = new Graphic({
          geometry: {
            type: "point",
            x: shelter._geometry!.x,
            y: shelter._geometry!.y,
            spatialReference: shelter._geometry!.spatialReference || { wkid: 102100 }
          } as __esri.Point,
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            color: [40, 167, 69, 0.9],
            size: 16,
            outline: { color: [255, 255, 255], width: 2 }
          }),
          attributes: { _isRoute: true, _type: "destination" },
          popupTemplate: {
            title: shelter.shelter_na,
            content: `<b>Address:</b> ${shelter.address}`
          }
        });
        graphicsLayerRef.current.add(destGraphic);

        // Zoom to show the entire route
        view.goTo(routeGraphic.geometry.extent.expand(1.3), {
          padding: { top: 50, bottom: 50, left: 50, right: 450 }
        }).catch(() => {});
      }

      // Offer next actions
      addMessage({
        type: "bot",
        content: "Is there anything else I can help you with?",
        options: [
          { label: "Find another shelter", value: "search-again" },
          { label: "Start over", value: "restart" },
          { label: "I'm all set", value: "no-done" }
        ]
      });
      setWaitingForInput("option");
    } catch (err) {
      addMessage({
        type: "error",
        content: "Sorry, there was an error getting directions."
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ===== ADDRESS INPUT =====
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

  function onInputChange(next: string) {
    setInputValue(next);
    if (waitingForInput === "address") {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => runSuggest(next), 180);
    }
  }

  function pickSuggestion(s: Suggestion) {
    setInputValue(s.text);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  function handleAddressSubmit() {
    const address = inputValue.trim();
    if (!address) return;

    setShowSuggestions(false);
    setWaitingForInput(null);

    if (currentFlow === "evacuation") {
      lookupEvacuationZone(address);
    } else if (currentFlow === "shelter") {
      setCollectedData((prev) => ({ ...prev, address }));
      // Need to geocode first
      geocodeAndContinueShelterFlow(address);
    } else if (currentFlow === "fullInfo") {
      lookupFullInfo(address);
    }

    setInputValue("");
  }

  async function geocodeAndContinueShelterFlow(address: string) {
    setIsLoading(true);
    addMessage({ type: "user", content: address });

    try {
      const geocodeResp = await fetch("/api/geocode/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address })
      });
      const geocodeData = await geocodeResp.json();

      if (!geocodeData.candidates || geocodeData.candidates.length === 0) {
        addMessage({
          type: "error",
          content: "I couldn't find that address. Please check the format and try again."
        });
        setWaitingForInput("address");
        setIsLoading(false);
        return;
      }

      const location = geocodeData.candidates[0];
      setCollectedData((prev) => ({
        ...prev,
        geocodedAddress: location.address,
        geocodedGeometry: location.location
      }));

      addMessage({
        type: "bot",
        content: `Great! I'll search for shelters near **${location.address}**.\n\nDo any of these apply to you?`
      });
      showShelterFilters();
    } catch (err) {
      addMessage({
        type: "error",
        content: "Sorry, there was an error. Please try again."
      });
      setWaitingForInput("address");
    } finally {
      setIsLoading(false);
    }
  }

  // ===== VISUALIZATION =====
  function visualizeLocation(geometry: any, address: string, zone?: string) {
    if (!view) return;

    if (!graphicsLayerRef.current) {
      const graphicsLayer = new GraphicsLayer({ title: "Helper Results" });
      view.map.add(graphicsLayer);
      graphicsLayerRef.current = graphicsLayer;
    }

    // Clear previous location marker
    const existingOrigin = graphicsLayerRef.current.graphics.find(
      (g: Graphic) => g.attributes?._isOrigin
    );
    if (existingOrigin) graphicsLayerRef.current.remove(existingOrigin);

    const originGraphic = new Graphic({
      geometry: {
        type: "point",
        x: geometry.x,
        y: geometry.y,
        spatialReference: geometry.spatialReference || { wkid: 102100 }
      } as __esri.Point,
      symbol: new SimpleMarkerSymbol({
        style: "diamond",
        color: [5, 65, 115, 0.9],
        size: 16,
        outline: { color: [255, 255, 255], width: 2 }
      }),
      attributes: { ADDRESS: address, ZONE: zone, _isOrigin: true },
      popupTemplate: {
        title: "Your Location",
        content: `<b>Address:</b> ${address}${zone ? `<br/><b>Zone:</b> ${zone}` : ""}`
      }
    });
    graphicsLayerRef.current.add(originGraphic);

    view.goTo(originGraphic, { zoom: 14 }).catch(() => {});
  }

  function visualizeShelters(shelters: Shelter[], geocodedLocation?: any) {
    if (!view || !graphicsLayerRef.current) return;

    // Clear previous shelter markers (but keep origin)
    const shelterGraphics = graphicsLayerRef.current.graphics.filter(
      (g: Graphic) => !g.attributes?._isOrigin && !g.attributes?._isRoute
    );
    shelterGraphics.forEach((g: Graphic) => graphicsLayerRef.current?.remove(g));

    shelters.forEach((shelter) => {
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
          color: shelter.status === "Open" ? [40, 167, 69, 0.9] : [255, 111, 91, 0.9],
          size: 14,
          outline: { color: [255, 255, 255], width: 2 }
        }),
        attributes: shelter,
        popupTemplate: {
          title: shelter.shelter_na,
          content: `
            <b>Address:</b> ${shelter.address}<br/>
            <b>Status:</b> ${shelter.status}<br/>
            <b>Available:</b> ${shelter.capacity - shelter.occupancy} spaces<br/>
            ${shelter.DISTANCE_MILES ? `<b>Distance:</b> ${shelter.DISTANCE_MILES.toFixed(2)} miles` : ""}
          `
        }
      });
      graphicsLayerRef.current?.add(graphic);
    });

    // Zoom to show all
    view.goTo(graphicsLayerRef.current.graphics.toArray(), {
      padding: { top: 50, bottom: 50, left: 50, right: 550 }
    }).catch(() => {});
  }

  function clearGraphics() {
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.removeAll();
    }
  }

  // ===== RENDER =====
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", color: "#000" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          background: brandBlue,
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Shelter Helper</h2>
        <button
          onClick={showMainMenu}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "white",
            padding: "4px 12px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Start Over
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: msg.type === "user" ? "flex-end" : "flex-start"
            }}
          >
            {/* Message bubble */}
            <div
              style={{
                maxWidth: "90%",
                padding: "10px 14px",
                borderRadius: msg.type === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background:
                  msg.type === "user"
                    ? brandBlue
                    : msg.type === "error"
                    ? "#f8d7da"
                    : msg.type === "info"
                    ? "#e8f4fd"
                    : "#f0f0f0",
                color:
                  msg.type === "user"
                    ? "white"
                    : msg.type === "error"
                    ? "#721c24"
                    : "#333",
                whiteSpace: "pre-wrap",
                fontSize: 14,
                lineHeight: 1.5
              }}
            >
              {/* Parse markdown-like formatting */}
              {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return <strong key={i}>{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </div>

            {/* Options */}
            {msg.options && waitingForInput === "option" && msg.id === messages[messages.length - 1]?.id && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                {msg.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleOptionSelect(opt.value)}
                    disabled={isLoading}
                    style={{
                      padding: "12px 16px",
                      border: `1px solid ${brandBlue}`,
                      borderRadius: 8,
                      background: "white",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      textAlign: "left",
                      opacity: isLoading ? 0.6 : 1
                    }}
                  >
                    <div style={{ fontWeight: 600, color: brandBlue, fontSize: 14 }}>{opt.label}</div>
                    {opt.description && (
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{opt.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Checkboxes */}
            {msg.checkboxes && waitingForInput === "checkbox" && msg.id === messages[messages.length - 1]?.id && (
              <div style={{ marginTop: 12, width: "100%" }}>
                {msg.checkboxes.map((cb) => (
                  <label
                    key={cb.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      marginBottom: 6,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: selectedCheckboxes.includes(cb.value) ? "#e3f2fd" : "white"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCheckboxes.includes(cb.value)}
                      onChange={(e) => {
                        if (cb.value === "none") {
                          setSelectedCheckboxes(e.target.checked ? ["none"] : []);
                        } else {
                          if (e.target.checked) {
                            setSelectedCheckboxes((prev) => [...prev.filter((v) => v !== "none"), cb.value]);
                          } else {
                            setSelectedCheckboxes((prev) => prev.filter((v) => v !== cb.value));
                          }
                        }
                      }}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 14, color: "#333" }}>{cb.label}</span>
                  </label>
                ))}
                <button
                  onClick={handleCheckboxSubmit}
                  disabled={isLoading}
                  style={{
                    marginTop: 8,
                    padding: "10px 20px",
                    background: brandBlue,
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    fontWeight: 600
                  }}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <div
              style={{
                width: 20,
                height: 20,
                border: "3px solid #f0f0f0",
                borderTopColor: brandBlue,
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }}
            />
            <span style={{ color: "#666", fontSize: 13 }}>Looking up information...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Address Input */}
      {waitingForInput === "address" && (
        <div style={{ padding: 16, borderTop: "1px solid #e0e0e0", background: "#fafafa" }}>
          <div style={{ position: "relative" }}>
            <input
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Enter address..."
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 14,
                border: "1px solid #ddd",
                borderRadius: 8
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (showSuggestions && suggestions.length > 0) {
                    pickSuggestion(suggestions[0]);
                  } else {
                    handleAddressSubmit();
                  }
                }
                if (e.key === "Escape") setShowSuggestions(false);
              }}
            />

            {showSuggestions && (suggestions.length > 0 || isSuggesting) && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  maxHeight: 200,
                  overflowY: "auto",
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  borderRadius: 8,
                  marginBottom: 4,
                  boxShadow: "0 -4px 12px rgba(0,0,0,0.1)"
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
                      cursor: "pointer",
                      fontSize: 13
                    }}
                  >
                    {s.text}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAddressSubmit}
            disabled={!inputValue.trim() || isLoading}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "12px 16px",
              background: brandBlue,
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: !inputValue.trim() || isLoading ? "not-allowed" : "pointer",
              opacity: !inputValue.trim() || isLoading ? 0.6 : 1,
              fontWeight: 600
            }}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
