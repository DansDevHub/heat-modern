AI Query Tool

The AI Query tool allows users to ask natural language questions about GIS datasets in Hillsborough County. Using local AI processing, the system translates questions into spatial queries and returns results that can be viewed on the map and exported to PDF.

To access the AI Query panel, click the Search icon button in the header toolbar. The AI Query panel will slide open from the left side of the screen.


Requirements

The AI Query tool requires Ollama to be installed and running locally on your computer. The Mistral language model should be installed in Ollama. The panel displays the connection status with a green indicator when connected and ready, or a red indicator when Ollama is not available.

To install Ollama:
1.	Download Ollama from https://ollama.ai
2.	Install and start Ollama
3.	Open a command prompt and run: ollama pull mistral


Asking Questions

To use the AI Query tool:
1.	Type your question in natural language in the text input field
2.	Click the Ask Question button or press Enter
3.	The system will analyze your question, generate a query plan, execute spatial queries against GIS datasets, and display results on the map and in a table

Example questions you can ask:
•	"Show me all flood zones" – Displays FEMA flood zone data
•	"Which schools are within 500 feet of a water treatment plant?" – Proximity analysis
•	"Find all fire stations within 1 mile of hospitals" – Distance-based query
•	"What is the zoning for parcels near downtown?" – Zoning information queries


Available Data Layers

The AI Query tool can access the following data layers:

Overlay Layers:
•	Zoning districts and classifications
•	FEMA flood zones and hazard areas
•	Future land use designations
•	Urban service area boundaries
•	Community and countywide planning areas
•	Planned development districts
•	Impact fee districts (Fire, Parks, Transportation)
•	Wind-borne debris regions (Hurricane Categories 1-4)
•	HCAA airport zones and notification areas
•	City of Tampa utility service areas
•	Mobility assessment and benefit districts
•	Historic resources
•	Redevelopment areas

Infrastructure Layers:
•	Parcels (property information, folio numbers, addresses)
•	Schools
•	Fire Stations
•	Hospitals
•	Libraries
•	Parks
•	Emergency Shelters
•	Water Treatment Plants
•	Wells (potable and production)


Understanding Results

After submitting a question, the system displays the Query Plan showing the steps it will execute, including which layers will be queried, buffer distances applied for proximity queries, and intersection operations performed.

Results are displayed in a scrollable table showing feature attributes from the queried layers with column headers based on the data returned.

Query results are automatically displayed on the map. Features are highlighted in orange with a semi-transparent fill. Results remain visible until you run a new query or clear them.

The AI generates a natural language summary of the findings, such as "Found 12 fire stations within 1 mile of hospital locations" or "No schools found within 500 feet of water treatment plants."


Exporting Results

Click the Export to PDF button to generate a PDF report containing Hillsborough County branding, your original question, date and time of the query, complete results table, and query summary. The PDF is automatically downloaded with a filename based on your question.


Tips for Best Results

•	Be specific – Include distances and units when asking proximity questions
•	Use available layers – Questions about data not in the available layers will return an error with suggestions
•	Check Ollama status – Ensure the green indicator shows before submitting queries
•	Review the query plan – Understanding what the system is doing helps interpret results


Troubleshooting

If you see "AI service unavailable," start Ollama on your computer.

If you see "Cannot answer this question," the requested data may not be available. Try rephrasing or asking about different layers.

If no results are returned, the spatial criteria may be too restrictive. Try larger distances.

If a query is taking too long, complex multi-step queries may require additional processing time.
