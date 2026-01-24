import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableCell,
  TableRow,
  Table,
  WidthType,
  ShadingType,
} from "docx";
import * as fs from "fs";

// Hillsborough County brand colors
const brandBlue = "054173";
const brandOrange = "FF6F5B";

function createScreenshotPlaceholder(description: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F0F0F0", type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 400 },
                children: [
                  new TextRun({
                    text: "[INSERT SCREENSHOT]",
                    bold: true,
                    color: "666666",
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
                children: [
                  new TextRun({
                    text: description,
                    italics: true,
                    color: "888888",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createDocument(): Document {
  return new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: {
            font: "Calibri",
            size: 24,
          },
          paragraph: {
            spacing: { after: 200 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: "HEAT",
                bold: true,
                size: 56,
                color: brandBlue,
                font: "Calibri",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: "User Guide",
                size: 36,
                color: brandOrange,
                font: "Calibri",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({
                text: "Hillsborough County Development Services",
                size: 24,
                color: "666666",
                font: "Calibri",
              }),
            ],
          }),

          // Introduction
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Introduction",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "HEAT is an interactive mapping application that allows you to explore parcel information, zoning data, flood zones, and other property-related information for Hillsborough County, Florida. This guide will help you navigate the application and make the most of its features.",
                size: 24,
              }),
            ],
          }),

          createScreenshotPlaceholder("Main application interface showing the map and header"),

          // Getting Started
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Getting Started",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "When you first open HEAT, you will see an interactive map of Hillsborough County. The application header at the top contains the Hillsborough County logo, application title, and toolbar buttons for accessing various features.",
                size: 24,
              }),
            ],
          }),

          // Header Toolbar
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Header Toolbar",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "The toolbar in the header provides quick access to the application's main features. Active buttons are highlighted in orange.",
                size: 24,
              }),
            ],
          }),

          createScreenshotPlaceholder("Header toolbar with buttons highlighted"),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Toolbar Buttons (Left to Right)",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),

          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Results Panel", bold: true, size: 24 }),
              new TextRun({ text: " - View detailed property information for selected parcels", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Draw Tools", bold: true, size: 24 }),
              new TextRun({ text: " - Draw shapes and annotations on the map", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Legend", bold: true, size: 24 }),
              new TextRun({ text: " - View the map legend showing layer symbols", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Layer List", bold: true, size: 24 }),
              new TextRun({ text: " - Toggle map layers on and off", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Basemap Gallery", bold: true, size: 24 }),
              new TextRun({ text: " - Change the background map style", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Create Address List", bold: true, size: 24 }),
              new TextRun({ text: " - Generate a list of addresses within a buffer area", size: 24 }),
            ],
          }),

          // Viewing Parcel Information
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Viewing Parcel Information",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "To view information about a specific parcel:",
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "Make sure the Results Panel is open (button should be orange)", size: 24 }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "Click on any parcel on the map", size: 24 }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "The Results Panel will display detailed information including:", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 1 },
            children: [
              new TextRun({ text: "Folio number and site address", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 1 },
            children: [
              new TextRun({ text: "Owner information", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 1 },
            children: [
              new TextRun({ text: "Zoning designation", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 1 },
            children: [
              new TextRun({ text: "Flood zone information", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 1 },
            children: [
              new TextRun({ text: "Future land use", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 1 },
            children: [
              new TextRun({ text: "Impact fees and other overlay data", size: 24 }),
            ],
          }),

          createScreenshotPlaceholder("Results Panel showing parcel information"),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Searching by Address",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "You can also search for a property by typing an address in the search box at the top of the Results Panel. As you type, suggestions will appear. Select a suggestion to zoom to that location and view its parcel information.",
                size: 24,
              }),
            ],
          }),

          createScreenshotPlaceholder("Address search with autocomplete suggestions"),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Exporting to PDF",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "To save or print parcel information, click the \"Export to PDF\" button at the bottom of the Results Panel. This will generate a PDF report containing all the displayed information along with a map image.",
                size: 24,
              }),
            ],
          }),

          // Create Address List
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Creating an Address List",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "The Address List feature allows you to generate a list of all properties within a specified distance of a selected parcel. This is useful for notification requirements and neighborhood analysis.",
                size: 24,
              }),
            ],
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Step 1: Select a Parcel",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "Click the \"Create Address List\" button in the header toolbar", size: 24 }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "In the panel that appears on the left, click \"Select Parcel\"", size: 24 }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "Click on the desired parcel on the map", size: 24 }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "The selected parcel will be highlighted in orange", size: 24 }),
            ],
          }),

          createScreenshotPlaceholder("Address List panel with parcel selected"),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Step 2: Set Buffer Distance",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "Enter the desired buffer distance in the \"Buffer Distance\" field", size: 24 }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "Select the unit of measurement (Feet or Miles)", size: 24 }),
            ],
          }),
          new Paragraph({
            numbering: { reference: "numbered", level: 0 },
            children: [
              new TextRun({ text: "Click \"Run Buffer\"", size: 24 }),
            ],
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Step 3: View and Export Results",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "After running the buffer, the map will display all parcels within the buffer area highlighted in blue. A table below shows the folio number, site address, and owner for each parcel.",
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: "Click \"Export to PDF\" to download a formatted report of all addresses in the buffer area.",
                size: 24,
              }),
            ],
          }),

          createScreenshotPlaceholder("Buffer results showing parcels within the buffer area"),

          // Map Navigation
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Map Navigation",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Basic Navigation",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Pan: ", bold: true, size: 24 }),
              new TextRun({ text: "Click and drag the map", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Zoom In/Out: ", bold: true, size: 24 }),
              new TextRun({ text: "Use the scroll wheel or the +/- buttons", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Home: ", bold: true, size: 24 }),
              new TextRun({ text: "Click the home button to return to the default extent", size: 24 }),
            ],
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Changing the Basemap",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Click the Basemap Gallery button in the toolbar to choose from different background map styles including streets, imagery, and topographic views.",
                size: 24,
              }),
            ],
          }),

          createScreenshotPlaceholder("Basemap Gallery showing available options"),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "Managing Layers",
                bold: true,
                color: brandBlue,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Click the Layer List button to open a draggable panel where you can toggle different data layers on and off. The Layer List panel can be moved around the screen by dragging its header.",
                size: 24,
              }),
            ],
          }),

          createScreenshotPlaceholder("Layer List panel showing available layers"),

          // Drawing Tools
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Drawing Tools",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "The Draw Tools allow you to add annotations and measurements to the map. Click the Draw button in the toolbar to access drawing options including:",
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Point, line, and polygon shapes", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Rectangles and circles", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Freehand drawing", size: 24 }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: "Drawings are temporary and will be cleared when you close the application or use the Clear All function.",
                italics: true,
                size: 24,
              }),
            ],
          }),

          createScreenshotPlaceholder("Draw Tools panel showing shape options"),

          // Tips
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Tips and Tricks",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Active toolbar buttons are highlighted in ", size: 24 }),
              new TextRun({ text: "orange", bold: true, color: brandOrange, size: 24 }),
              new TextRun({ text: " so you can easily see which panels are open", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "The Layer List panel can be dragged anywhere on screen for convenience", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Use the address search for faster navigation to specific properties", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Export results to PDF for record-keeping or sharing", size: 24 }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "When using the Address List tool, closing the panel will clear the temporary graphics from the map", size: 24 }),
            ],
          }),

          // Support
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Need Help?",
                bold: true,
                color: brandBlue,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "For technical support or questions about HEAT, please contact Hillsborough County Development Services.",
                size: 24,
              }),
            ],
          }),

          // Footer
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600 },
            children: [
              new TextRun({
                text: "Hillsborough County",
                bold: true,
                color: brandBlue,
                size: 24,
              }),
              new TextRun({
                text: " Florida",
                bold: true,
                color: brandOrange,
                size: 24,
              }),
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
  fs.writeFileSync("HEAT_User_Guide.docx", buffer);
  console.log("Document created: HEAT_User_Guide.docx");
}

main().catch(console.error);
