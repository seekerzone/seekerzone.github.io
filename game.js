// Function to get query parameter by name
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function onMapClick(e) { 
    const latLng = e.latlng;
    const coordinates = `${latLng.lat.toFixed(5)},${latLng.lng.toFixed(5)}`;

    // Copy coordinates to clipboard
    navigator.clipboard.writeText(coordinates)
        .then(() => {
          popup
           .setLatLng(latLng)
           .setContent(`Coordinates copied: ${latLng.lat.toFixed(5)},${latLng.lng.toFixed(5)}`)
           .openOn(map);
        })
        .catch(err => {
            alert("Failed to copy coordinates: " + err);
        });
   }

function radar(center, radius, success) {
    const div = (gameSettings.unit === 'miles') ? 69.08 : 111.1735;
    // Create a D3 circle using d3.geoCircle
    const circle = d3.geoCircle()
        .center([center[1], center[0]])  
        .radius(radius / div) // Radius in degrees (from miles)
        .precision(18)();  
 
    // Handle success or failure
    if (success) {
        // The radar is a hit: intersect the current area with the circle
        currentArea = turf.intersect(currentArea, circle);
    } else {
        // The radar is a miss: subtract the circle from the current area
        currentArea = turf.difference(currentArea, circle);
    }

    // Update the map
    updateMap();
}

function tentacles(center, radius, points, index) {
    if (index < 0 || index >= points.length+1) {// Ensure the index is within the bounds of the points array (count we are adding +1)
        throw new Error("Invalid index: Ensure the index is within the bounds of the points array.");
    }
    if (index === 0){//outside of the radar
        radar(center, radius, false);
        return;

    }
    else{//radar is a hit
        radar(center, radius, true); 
        const turfPoints = points.map((point) => turf.flip(turf.point(point)));
        const pointsCollection = turf.featureCollection(turfPoints); 
        const voronoiPolygons = d3_project(d3.geoVoronoi(pointsCollection).polygons()); 
        currentArea = turf.intersect(voronoiPolygons.features[index-1], currentArea);
        updateMap();
    }
}


async function measuringLake(distance, closer, unit=gameSettings.unit, area_threshold = gameSettings.lake_definition*1000000) {
    const bbox = turf.bbox(currentArea);

    const query = `
    [out:json];
    (
    way["water"="lake"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
    relation["water"="lake"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
    way["water"="reservoir"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
    relation["water"="reservoir"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
    way["water"="pond"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
    relation["water"="pond"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
    );
    (._;>;);
    out body;
    `;

    // Fetch the data from the Overpass API
    const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
        headers: {
            "Content-Type": "text/plain",
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch Overpass data: ${response.statusText}`);
    }
    const osmData = await response.json();
    const geojson = osmtogeojson(osmData);

    var lakes = turf.featureCollection(geojson.features); 
    // Filter and simplify features
    lakes = lakes.features
    .filter((feature) => {
        const areaInSquareMeters = turf.area(feature); 
        return areaInSquareMeters-10000 >= area_threshold; //default 0.2 sqkm (add some buffer for accounting between different sources)
    })
    .map((feature) => {
        const simplifiedFeature = turf.simplify(feature, {
            tolerance: 0.0005,
            highQuality: true,
        });
        return simplifiedFeature;
    });
    lakes = turf.buffer(turf.featureCollection(lakes), distance, {units: gameSettings.unit})
    lakes = turf.combine(lakes).features[0]; 
    if (closer){
        currentArea = turf.intersect(currentArea,lakes);
    }else{
        currentArea = turf.difference(currentArea,lakes);
    }
    updateMap();   
}

function matchingPoints(points, index){ //Is your closest (element from a set of points) the same as ours? 
    const turfPoints = points.map((point) => turf.flip(turf.point(point)));
    const pointsCollection = turf.featureCollection(turfPoints);
    const voronoiPolygons = d3_project(d3.geoVoronoi(pointsCollection).polygons());
    currentArea = turf.intersect(voronoiPolygons.features[index], currentArea);
    updateMap();
}

function measuringPoints(points,distance,closer){//Are you closer or further from (any element within a set of points) compared to me? 
    const div = (gameSettings.unit === 'miles') ? 69.08 : 111.1735;
    if(closer){
    const circleFeatures = points.map(point => d3.geoCircle()
            .center([point[1], point[0]])
            .radius(distance / 69.08) // Convert distance to degrees
            .precision(18)());
    const combinedCircles = turf.union(...turf.featureCollection(circleFeatures).features);
    currentArea = turf.intersect(combinedCircles, currentArea);
    updateMap();

    }else{
    points.forEach((point) => {
        // Apply the radar function for each point 
        radar(point, distance, closer);
    });
    }
}

async function measuringMcDonalds(distance,closer){ 
    const bbox = turf.bbox(currentArea); 
    const query = `
    [out:json];
    (
        node["amenity"="fast_food"]["brand"="McDonald's"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
        way["amenity"="fast_food"]["brand"="McDonald's"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
        relation["amenity"="fast_food"]["brand"="McDonald's"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});
    );
    (._;>;);
    out body;
    `;
    // Fetch data from Overpass API
    const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
        headers: {
            "Content-Type": "text/plain",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Overpass data: ${response.statusText}`);
    }  
    const osmData = await response.json(); 
    const geojson = osmtogeojson(osmData);  
    
    
    const points = geojson.features.map(feature => {
        const coords = feature.geometry.coordinates;
        return Array.isArray(coords[0]) ? [coords[0][1], coords[0][0]] : [coords[1], coords[0]];
    });
    measuringPoints(points,distance,closer);
}

async function matchingArea(id, isMatching){//Are you within the same area as us? 
    const query = `
    [out:json];
    relation(${id}); 
    (._;>;); 
    out body; on
    `;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
        headers: {
            "Content-Type": "text/plain",
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch Overpass data: ${response.statusText}`);
    }
    const osmData = await response.json();
    const geojson = osmtogeojson(osmData);
    var items = turf.combine(turf.featureCollection(geojson.features));  
    items = items.features.filter(
        (feature) => feature.geometry.type === 'MultiPolygon' || feature.geometry.type === 'Polygon'
    )[0];

    if(isMatching){
        currentArea = turf.intersect(currentArea, items);
    }else{
        currentArea = turf.difference(currentArea, items);
    }
    updateMap();
}

async function matchingTrainLine(id, isMatching, gameArea = gameSettings.hiding_area){//Does our train/bus service stop at your station (considering the whole service and not only the train we boarded)? 
    const query = `
    [out:json];
    relation(${id}) -> .rel;
    node(r.rel:stop);     
    out body;
    `;

    // Fetch the data from the Overpass API
    const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
        headers: {
            "Content-Type": "text/plain",
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch Overpass data: ${response.statusText}`);
    }
    const osmData = await response.json();
    const geojson = osmtogeojson(osmData); 
    var items = turf.combine(turf.featureCollection(geojson.features)).features[0]; //Should extract a Multipoint here
    //Add an assert maybe
    items = turf.buffer(items, gameArea); //The buffer size needs to be dependant on the game type
    if(isMatching){
        currentArea = turf.intersect(currentArea, items);
    }else{
        currentArea = turf.difference(currentArea, items);
    }
    updateMap();
}
 

async function getTransportationCoordinates(modes = gameSettings.types_of_transportation){//train,bus,subway,lightrail,monorail,funicular
    // Bounding box for the query (you may need to define or pass it)
    const bbox = turf.bbox(currentArea);

    // Construct the Overpass query
    const query = `
    [out:json];
    (
        ${modes.map(mode => `node["${mode}"="yes"](${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]});`).join('\n')}
    );
    (._;>;);
    out body;
    `;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
        headers: {
            "Content-Type": "text/plain",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Overpass data: ${response.statusText}`);
    }

    const osmData = await response.json();
    const geojson = osmtogeojson(osmData);
    return geojson.features.map(feature => { //List of coordinates (check that is array of array of 2 values)
        const coords = feature.geometry.coordinates;
        return Array.isArray(coords[0]) ? [coords[0][1], coords[0][0]] : [coords[1], coords[0]];
    });
}


async function measuringElevation(elevation, isHigher, gameArea=gameSettings.hiding_area, safeBound = 5) { //Compared to my elevation has your station a higher elevation?
    //Safebound used to account for possible difference in elevations between datasets
    var stations = await getTransportationCoordinates(['train']);  
    if(stations.length > 5000){
        alert("Too many stations, upper limit is 5000");
    }  
    const url = "https://api.open-elevation.com/api/v1/lookup";
    const locationsPayload = {
        locations: stations.map(([lat, lon]) => ({ latitude: lat, longitude: lon }))
    };
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(locationsPayload)
    });
    
    if (!response.ok) {
        throw new Error(`Error fetching elevation data: ${response.statusText}`);
    }
    
    const data = await response.json(); 
    // Step 1: Filter and map to coordinates
    var coordinates = data.results
        .filter(item => isHigher ? item.elevation+safeBound > elevation : item.elevation-safeBound <= elevation) //
        .map(item => [item.longitude, item.latitude]); // Note: longitude first 

    if (coordinates.length === 0) { //All the train stations are either below or above the player
        return;
    }

    var points = coordinates.map(coord => turf.point(coord)); 

    var items = turf.combine(turf.featureCollection(points)).features[0]; 
    items = turf.buffer(items, gameArea); 
    currentArea = turf.intersect(currentArea, items); 
    updateMap();
}

function updateMap(){
    const world = {
        "type": "Polygon",
        "coordinates": [ [ [ -180, -90 ], [  180, -90 ], [  180,  90 ], [ -180,  90 ], [ -180, -90 ] ] ]
      };
    // Remove the existing map layer
    try {
        map.removeLayer(currentLayer); // Remove each layer from the map
    } catch (e) {
        console.error("Problem removing layer: ", e);
    }

    // Add the new layer to the map
    try{
        currentLayer = L.geoJSON(turf.difference(world,currentArea), {
            style: {
                color: "red", // Set a custom color for the combined polygon
                weight: 2,
                opacity: 1,
                fillOpacity: 0.1,
            },
        });
    }catch (e) {
        console.log(`No possible area where the hider can be found, maybe recheck your informaiton or copy this message: ${e}`);
    }
    currentLayer.addTo(map);

    // Fit the map to the bounds of the updated area
    const bounds = L.geoJSON(currentArea).getBounds();
    map.fitBounds(bounds);
}

function d3_project(polygons){
    return d3.geoProject(
        d3.geoProject(
            polygons,
          d3
            .geoEquirectangular()
            .scale(180 / Math.PI)
            .translate([0, 0])
        ),
        d3.geoIdentity().reflectY(true)
      );
}

//games settings: size of hiding area, kilometers or miles, definition of lake, coordinates of airports, types of transportations stops