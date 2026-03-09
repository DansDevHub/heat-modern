import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import * as fs from "fs";
import * as path from "path";

// Hillsborough County brand colors
const brandBlue = "054173";
const brandOrange = "FF6F5B";

// Max width for images in the document (in EMUs; 6 inches = 5486400 EMUs)
const MAX_WIDTH_EMU = 5486400;

function createScreenshot(imagePath: string, caption: string): Paragraph[] {
  const imgBuffer = fs.readFileSync(imagePath);
  // Read PNG dimensions from header
  const origW = imgBuffer.readUInt32BE(16);
  const origH = imgBuffer.readUInt32BE(20);
  // Scale to fit max width (6 inches), converting pixels to EMUs (assume 96 DPI → 1 px = 9525 EMU)
  const PX_TO_EMU = 9525;
  let widthEmu = origW * PX_TO_EMU;
  let heightEmu = origH * PX_TO_EMU;
  if (widthEmu > MAX_WIDTH_EMU) {
    const scale = MAX_WIDTH_EMU / widthEmu;
    widthEmu = MAX_WIDTH_EMU;
    heightEmu = Math.round(heightEmu * scale);
  }

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new ImageRun({
          data: imgBuffer,
          transformation: { width: Math.round(widthEmu / PX_TO_EMU), height: Math.round(heightEmu / PX_TO_EMU) },
          type: "png",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: caption,
          italics: true,
          color: "888888",
          size: 20,
        }),
      ],
    }),
  ];
}

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, color: brandBlue, size: 32 })],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, color: brandBlue, size: 26 })],
  });
}

function para(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 24 })],
  });
}

function bullet(label: string, desc: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    children: [
      new TextRun({ text: label, bold: true, size: 24 }),
      new TextRun({ text: " \u2014 " + desc, size: 24 }),
    ],
  });
}

function simpleBullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 24 })],
  });
}

function numbered(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "numbered", level: 0 },
    children: [new TextRun({ text, size: 24 })],
  });
}

function createDocument(): Document {
  return new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Calibri", size: 24 },
          paragraph: { spacing: { after: 200 } },
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: [
          // ── Title ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "HEAT", bold: true, size: 56, color: brandBlue, font: "Calibri" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "Hurricane Evacuation Assessment Tool", size: 28, color: brandBlue, font: "Calibri" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({ text: "User Guide", size: 36, color: brandOrange, font: "Calibri" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({ text: "Hillsborough County Emergency Management", size: 24, color: "666666", font: "Calibri" }),
            ],
          }),

          // ── Introduction ──
          h1("Introduction"),
          para(
            "HEAT (Hurricane Evacuation Assessment Tool) is an interactive mapping application designed to help Hillsborough County residents prepare for and respond to hurricane events. The application provides real-time alerts, shelter information, evacuation zone lookup, driving directions to shelters, and interactive map tools."
          ),
          ...createScreenshot(path.join("Screenshots", "1.png"), "Main application interface showing the map, header toolbar, and Alerts panel"),

          // ── Getting Started ──
          h1("Getting Started"),
          para(
            "When you first open HEAT, you will see an interactive map of Hillsborough County with the Alerts & Information panel displayed in the lower-left corner. The blue header bar at the top contains the Hillsborough County logo, the HEAT title, information links, and a toolbar with buttons for accessing various features."
          ),
          para(
            "Active toolbar buttons are highlighted in orange so you can easily see which panels are open. Only one side panel can be open at a time \u2014 opening a new panel will automatically close the previous one. The Alerts & Information panel operates independently and can remain visible alongside any side panel."
          ),

          // ── Alerts & Information ──
          h1("Alerts & Information"),
          para(
            "The Alerts & Information panel is a floating card in the lower-left corner of the screen. It displays the most recent emergency alert and a table of currently open shelters. The panel automatically refreshes every 2 minutes."
          ),
          ...createScreenshot(path.join("Screenshots", "2.png"), "Alerts & Information panel showing a critical alert and open shelters table"),

          h2("Alert Messages"),
          para(
            "The panel displays the single most recent alert message. Alerts are color-coded by severity:"
          ),
          bullet("Critical (Red)", "Immediate action required, such as mandatory evacuation orders"),
          bullet("Warning (Yellow)", "Significant weather events or voluntary evacuation notices"),
          bullet("Info (Blue)", "General information and preparedness updates"),

          h2("Open Shelters Table"),
          para(
            "Below the alert message, a table lists all currently open shelters. Each row shows:"
          ),
          simpleBullet("Shelter name (clickable \u2014 click to zoom to the shelter on the map and view its details)"),
          simpleBullet("Address"),
          simpleBullet("Whether the shelter is pet friendly"),
          simpleBullet("Available spaces (color-coded: green = plenty of room, yellow = filling up, red = nearly full)"),

          h2("Minimize, Restore, and Dismiss"),
          para(
            "The panel has three window-style buttons in the upper-right corner:"
          ),
          bullet("\u2013 (Minimize)", "Collapses the panel to show only the latest alert message in a compact bar"),
          bullet("\u25A1 (Restore)", "Expands the panel back to its full size"),
          bullet("\u00D7 (Dismiss)", "Hides the panel completely. Use the Alerts toolbar button to bring it back"),
          para(
            "When minimized, you can still see the most recent alert severity and message at a glance."
          ),

          // ── Find Shelters ──
          h1("Find Shelters"),
          para(
            "The Find Shelters panel helps you search for hurricane shelters based on your specific needs."
          ),
          ...createScreenshot(path.join("Screenshots", "3.png"), "Find Shelters panel with filter options"),

          h2("How to Use"),
          numbered("Click the Find Shelters button (building icon) in the toolbar"),
          numbered("Enter your address in the search box \u2014 suggestions will appear as you type"),
          numbered("Select filters such as pet friendly, ADA accessible, or open shelters only"),
          numbered("View matching shelters in the results list"),
          numbered("Click on a shelter name to zoom to its location on the map"),
          numbered("Click \"Get Directions\" to receive turn-by-turn driving directions from your address to the shelter"),

          h2("Shelter Details"),
          para(
            "Each shelter result shows the shelter name, address, status (open/closed), capacity, current occupancy, whether it accepts pets, and the distance from your location."
          ),

          // ── Shelter Helper ──
          h1("Shelter Helper"),
          para(
            "The Shelter Helper is a guided, conversational assistant that walks you through the process of finding the right shelter step by step."
          ),
          ...createScreenshot(path.join("Screenshots", "4.png"), "Shelter Helper panel showing the guided conversation"),

          h2("How to Use"),
          numbered("Click the Shelter Helper button (chat icon) in the toolbar"),
          numbered("Choose from the menu options: check your evacuation zone, find a shelter, check shelter status, or get complete evacuation information"),
          numbered("Follow the prompts \u2014 enter your address when asked, select your preferences, and the helper will find the best options for you"),
          numbered("The helper can also provide driving directions to your chosen shelter"),

          h2("Features"),
          simpleBullet("Evacuation zone lookup \u2014 find out which hurricane evacuation zone your address is in"),
          simpleBullet("Personalized shelter search based on pet needs, ADA accessibility, and availability"),
          simpleBullet("Full evacuation info \u2014 get your zone, matching shelters, and directions all in one flow"),
          simpleBullet("Click \"Start Over\" at any time to restart the conversation"),

          // ── Map Navigation ──
          h1("Map Navigation"),

          h2("Basic Controls"),
          bullet("Pan", "Click and drag the map to move around"),
          bullet("Zoom", "Use the scroll wheel, pinch gesture, or the + / \u2013 buttons in the upper left"),
          bullet("Home", "Click the home button to return to the default county-wide view. This also resets open shelter/helper panels and restores the Alerts panel"),
          bullet("Find My Location", "Click the location button (below the zoom controls) to zoom to your current GPS position"),

          h2("Legend"),
          para(
            "Click the Legend button in the toolbar to open the Legend panel on the right side. The legend shows the symbols used for each visible map layer, helping you understand what the colors and icons on the map represent."
          ),

          h2("Layer List"),
          para(
            "Click the Layer List button to open the Layers panel. Here you can toggle individual map layers on and off to customize what information is displayed on the map."
          ),

          h2("Basemap Gallery"),
          para(
            "Click the Basemap Gallery button to choose from different background map styles including streets, satellite imagery, topographic views, and more."
          ),
          ...createScreenshot(path.join("Screenshots", "5.png"), "Basemap Gallery showing available map styles"),

          // ── AI Query ──
          h1("AI Query"),
          para(
            "The AI Query panel allows you to ask natural language questions about geographic data in Hillsborough County. This feature uses an AI assistant to interpret your question and query the appropriate map layers."
          ),
          ...createScreenshot(path.join("Screenshots", "6.png"), "AI Query panel with a sample question and result"),

          h2("Example Questions"),
          simpleBullet("\"What evacuation zone is 601 E Kennedy Blvd in?\""),
          simpleBullet("\"Find the nearest open shelter to 123 Main St Tampa\""),
          simpleBullet("\"Find open pet-friendly shelters\""),
          simpleBullet("\"Get directions from 789 Pine St to Burnett Middle School\""),

          // ── Information Links ──
          h1("Information Links"),
          para(
            "The header bar contains several links to important resources:"
          ),
          bullet("HCFL Alerts", "Sign up for Hillsborough County emergency alerts via Everbridge"),
          bullet("Hurricane Preparedness", "Access the county's hurricane preparedness guide on HCFLGov.net"),
          bullet("Disaster Guide (English/Spanish)", "Download the official disaster preparedness guide"),
          bullet("Important Contacts", "View a comprehensive table of emergency contact numbers for agencies including law enforcement, utilities, crisis counseling, transit, and more"),

          // ── Tips ──
          h1("Tips"),
          simpleBullet("The Alerts panel refreshes automatically every 2 minutes. You can also click the Refresh button for an immediate update."),
          simpleBullet("Click any shelter name in the Alerts panel or Find Shelters results to zoom directly to it on the map."),
          simpleBullet("Active toolbar buttons are highlighted in orange so you can see which panel is currently open."),
          simpleBullet("The Home button resets your map view and closes the shelter/helper panels, returning the Alerts panel to its expanded state."),
          simpleBullet("Use the Find My Location button to quickly center the map on your current position."),
          simpleBullet("The Shelter Helper provides a step-by-step guided experience, while Find Shelters offers more direct filter-based searching."),

          // ── Support ──
          h1("Need Help?"),
          para(
            "For technical support or questions about HEAT, please contact Hillsborough County Emergency Management."
          ),
          para(
            "For general hurricane preparedness information, call the Hillsborough County Customer Service Call Center at (813) 272-5900 or visit HCFLGov.net/StaySafe."
          ),

          // ── Footer ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600 },
            children: [
              new TextRun({ text: "Hillsborough County", bold: true, color: brandBlue, size: 24 }),
              new TextRun({ text: " Florida", bold: true, color: brandOrange, size: 24 }),
            ],
          }),
        ],
      },
    ],
    numbering: {
      config: [
        {
          reference: "numbered",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
  });
}

async function main() {
  const doc = createDocument();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("apps/web/public/assets/HEAT_User_Guide.docx", buffer);
  console.log("Document created: apps/web/public/assets/HEAT_User_Guide.docx");
}

main().catch(console.error);
